import { randomUUID } from "node:crypto";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import {
  HeadObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getAwsClients } from "./clients.server";
import { getRuntimeConfig } from "./runtime.server";
import { getRecords, change, auditChange } from "./records.server";
import type { User } from "@/types";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const formats = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
interface Upload {
  owner: string;
  pendingKey: string;
  finalKey: string;
  type: keyof typeof formats;
  size: number;
  expiresAt: number;
  complete: boolean;
}
export function isImageSignature(bytes: Uint8Array, type: string) {
  const buffer = Buffer.from(bytes);
  if (type === "image/png")
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/jpeg") return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (type === "image/webp")
    return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
}
export async function beginImageUpload(type: keyof typeof formats, size: number, actor: User) {
  const config = getRuntimeConfig();
  if (config.mode !== "cloud")
    throw new Error("S3 upload requires cloud mode. Use an HTTPS image URL in demo mode.");
  const id = randomUUID();
  const upload: Upload = {
    owner: actor.id,
    pendingKey: `uploads/pending/${id}.${formats[type]}`,
    finalKey: `media/${id}.${formats[type]}`,
    type,
    size,
    expiresAt: Date.now() + 15 * 60000,
    complete: false,
  };
  const signed = await createPresignedPost(getAwsClients().s3, {
    Bucket: config.mediaBucket,
    Key: upload.pendingKey,
    Expires: 300,
    Fields: { "Content-Type": type },
    Conditions: [
      ["content-length-range", 1, MAX_IMAGE_BYTES],
      ["eq", "$Content-Type", type],
    ],
  });
  await getRecords().transaction([change("UPLOAD", id, null, upload)]);
  return { id, url: signed.url, fields: signed.fields };
}
export async function completeImageUpload(id: string, actor: User) {
  const row = await getRecords().get<Upload>("UPLOAD", id);
  if (!row || row.value.owner !== actor.id) throw new Error("Upload not found.");
  const config = getRuntimeConfig();
  if (row.value.complete)
    return { key: row.value.finalKey, url: `${config.mediaBaseUrl}/${row.value.finalKey}` };
  if (row.value.expiresAt < Date.now()) throw new Error("Upload expired.");
  const head = await getAwsClients().s3.send(
    new HeadObjectCommand({ Bucket: config.mediaBucket, Key: row.value.pendingKey }),
  );
  const bytes = await getAwsClients().s3.send(
    new GetObjectCommand({
      Bucket: config.mediaBucket,
      Key: row.value.pendingKey,
      Range: "bytes=0-15",
    }),
  );
  if (
    !head.ContentLength ||
    head.ContentLength !== row.value.size ||
    head.ContentLength > MAX_IMAGE_BYTES ||
    head.ContentType !== row.value.type ||
    !bytes.Body ||
    !isImageSignature(await bytes.Body.transformToByteArray(), row.value.type)
  ) {
    await getAwsClients().s3.send(
      new DeleteObjectCommand({ Bucket: config.mediaBucket, Key: row.value.pendingKey }),
    );
    throw new Error("Upload size, type or image signature is invalid.");
  }
  // Pending objects are never served by CloudFront. Publish only validated media.
  await getAwsClients().s3.send(
    new CopyObjectCommand({
      Bucket: config.mediaBucket,
      Key: row.value.finalKey,
      CopySource: `${config.mediaBucket}/${row.value.pendingKey}`,
      MetadataDirective: "REPLACE",
      ContentType: row.value.type,
      CacheControl: "public,max-age=31536000,immutable",
    }),
  );
  await getRecords().transaction([
    change("UPLOAD", id, row, { ...row.value, complete: true }),
    auditChange(actor.id, "media.uploaded", row.value.finalKey),
  ]);
  await getAwsClients().s3.send(
    new DeleteObjectCommand({ Bucket: config.mediaBucket, Key: row.value.pendingKey }),
  );
  return { key: row.value.finalKey, url: `${config.mediaBaseUrl}/${row.value.finalKey}` };
}
