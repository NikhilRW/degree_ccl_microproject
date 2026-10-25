import { z } from "zod";

export const assetSchema = z.object({
  photoId: z.string().regex(/^(photo|commons)-[a-zA-Z0-9-]+$/),
  key: z.string().regex(/^catalogue\/(photo|commons)-[a-zA-Z0-9-]+\.jpg$/),
  s3Url: z.string().startsWith("s3://"),
  relativePath: z.string().regex(/^images\/(photo|commons)-[a-zA-Z0-9-]+\.jpg$/),
  contentType: z.literal("image/jpeg"),
  cacheControl: z.literal("private, max-age=300"),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  source: z.enum(["local", "download", "prepared-cache"]),
  sourceUrls: z.array(z.string().url()).min(1),
  metadata: z.record(z.string(), z.string()),
});
export type Asset = z.infer<typeof assetSchema>;
export const uploadManifestSchema = z.object({
  version: z.literal(1),
  classification: z.literal("SAMPLE"),
  sourceCommit: z.string(),
  bucket: z.string(),
  region: z.string(),
  tableName: z.string().optional(),
  importReady: z.boolean(),
  assets: z.array(assetSchema),
});
