import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function encryptSession(value: unknown, key: Buffer, binding = ""): string {
  if (key.length !== 32) throw new Error("Invalid session encryption key");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(binding, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}
export function decryptSession<T>(envelope: string, key: Buffer, binding = ""): T {
  const bytes = Buffer.from(envelope, "base64url");
  if (bytes.length < 29 || key.length !== 32) throw new Error("Invalid session envelope");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(binding, "utf8"));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"),
  ) as T;
}
