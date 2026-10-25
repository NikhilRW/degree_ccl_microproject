/** Explicit operator action: private S3 uploads first, then conditional DynamoDB import. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, parseArgs, promisify } from "node:util";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { uploadManifestSchema } from "./catalogue-assets";
import { catalogueRecords, validateCatalogue } from "./catalogue-schema";

const { values } = parseArgs({ options: {
  directory: { type: "string", default: ".local/catalogue-restore" },
  "expected-account": { type: "string" },
  apply: { type: "boolean", default: false },
} });
if (!values["expected-account"] || !/^\d{12}$/.test(values["expected-account"]))
  throw new Error("Usage: npm run publish:catalogue -- --expected-account ACCOUNT [--directory DIR] [--apply]");
const directory = resolve(values.directory);
const manifest = uploadManifestSchema.parse(JSON.parse(await readFile(join(directory, "upload-manifest.json"), "utf8")));
const cataloguePath = join(directory, "catalogue.json");
const catalogue = validateCatalogue(JSON.parse(await readFile(cataloguePath, "utf8")));
if (!manifest.importReady || !manifest.tableName) throw new Error("Missing ready manifest/table name.");
const table = manifest.tableName;
const run = promisify(execFile);
async function aws(...args: string[]): Promise<unknown> {
  const { stdout } = await run("aws", [...args, "--region", manifest.region, "--output", "json", "--no-cli-pager"], {
    encoding: "utf8", timeout: 60000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
  });
  return stdout.trim() ? JSON.parse(stdout) : {};
}
const identity = z.object({ Account: z.string() }).parse(await aws("sts", "get-caller-identity"));
if (identity.Account !== values["expected-account"]) throw new Error("Wrong AWS account; no writes attempted.");
const privacy = z.object({ PublicAccessBlockConfiguration: z.object({
  BlockPublicAcls: z.literal(true), IgnorePublicAcls: z.literal(true),
  BlockPublicPolicy: z.literal(true), RestrictPublicBuckets: z.literal(true),
}) }).parse(await aws("s3api", "get-public-access-block", "--bucket", manifest.bucket));
const listed = z.object({ Contents: z.array(z.object({ Key: z.string() })).optional() }).parse(
  await aws("s3api", "list-objects-v2", "--bucket", manifest.bucket, "--prefix", "catalogue/"),
);
const existingKeys = new Set(listed.Contents?.map((item) => item.Key) ?? []);
const headSchema = z.object({
  ContentLength: z.number(), ContentType: z.string(), CacheControl: z.string().optional(),
  ServerSideEncryption: z.enum(["AES256", "aws:kms", "aws:kms:dsse"]),
  Metadata: z.record(z.string(), z.string()),
});
const assetUrls = new Set(manifest.assets.map((asset) => asset.s3Url));
if (assetUrls.size !== manifest.assets.length) throw new Error("Duplicate image destinations.");
const references = [...catalogue.products.flatMap((product) => product.images), ...catalogue.categories.map((category) => category.image)];
if (references.some((url) => !assetUrls.has(url))) throw new Error("An image reference has no prepared upload asset.");
for (const asset of manifest.assets) {
  if (asset.s3Url !== `s3://${manifest.bucket}/${asset.key}` || asset.key !== `catalogue/${asset.photoId}.jpg` ||
    asset.relativePath !== `images/${asset.photoId}.jpg`) throw new Error("Unexpected asset destination/path.");
  const bytes = await readFile(join(directory, asset.relativePath));
  if (bytes.length !== asset.bytes || createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
    throw new Error(`Local image hash mismatch: ${asset.photoId}.`);
  if (existingKeys.has(asset.key)) {
    const head = headSchema.parse(await aws("s3api", "head-object", "--bucket", manifest.bucket, "--key", asset.key));
    if (head.ContentLength !== asset.bytes || head.Metadata.sha256 !== asset.sha256 || head.ContentType !== asset.contentType ||
      head.CacheControl !== asset.cacheControl || !isDeepStrictEqual(head.Metadata, asset.metadata))
      throw new Error(`Refusing to overwrite different existing S3 object: ${asset.key}.`);
  }
}
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: manifest.region, maxAttempts: 3 }));
const records = catalogueRecords(catalogue);
try {
  let identicalRecords = 0;
  for (const record of records) {
    const result = await client.send(new GetCommand({ TableName: table, Key: { pk: record.pk, sk: record.sk }, ConsistentRead: true }));
    if (result.Item) {
      if (!isDeepStrictEqual(result.Item, record)) throw new Error(`Different existing DynamoDB record: ${record.pk}/${record.sk}. No writes attempted.`);
      identicalRecords++;
    }
  }
  console.log(`Preflight passed: ${records.length} records (${identicalRecords} identical), ${manifest.assets.length} image assets, private bucket, account ${identity.Account}.`);
  if (!values.apply) {
    console.log("Read-only preflight complete. Pass --apply to upload images and import records.");
  } else {
    const queue = manifest.assets.filter((asset) => !existingKeys.has(asset.key));
    const uploaded = queue.length;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const asset = queue.shift();
        if (!asset) break;
        // No ACL or bucket-policy changes. Keep the bucket's default encryption.
        await aws("s3api", "put-object", "--bucket", manifest.bucket, "--key", asset.key,
          "--body", join(directory, asset.relativePath), "--content-type", asset.contentType,
          "--cache-control", asset.cacheControl, "--metadata", JSON.stringify(asset.metadata), "--if-none-match", "*");
        console.log(`Uploaded ${asset.key}`);
      }
    }));
    // Verify EVERY object before invoking the database importer.
    const heads = [];
    for (const asset of manifest.assets) {
      const head = headSchema.parse(await aws("s3api", "head-object", "--bucket", manifest.bucket, "--key", asset.key));
      if (head.ContentLength !== asset.bytes || head.Metadata.sha256 !== asset.sha256 ||
        head.ContentType !== asset.contentType || head.CacheControl !== asset.cacheControl || !isDeepStrictEqual(head.Metadata, asset.metadata))
        throw new Error(`Uploaded S3 object verification failed: ${asset.key}. Database import not started.`);
      heads.push({ key: asset.key, bytes: head.ContentLength, encryption: head.ServerSideEncryption });
    }
    const importer = join(dirname(fileURLToPath(import.meta.url)), "import-catalogue.ts");
    const result = await run(process.execPath, [fileURLToPath(import.meta.resolve("tsx/cli")), importer,
      "--file", cataloguePath, "--table", table, "--region", manifest.region, "--skip-identical"], {
      encoding: "utf8", timeout: 120000, maxBuffer: 2 * 1024 * 1024,
    });
    console.log(result.stdout.trim());
    async function query(pk: string, prefix: string) {
      const items: Record<string, unknown>[] = [];
      let cursor: ConstructorParameters<typeof QueryCommand>[0]["ExclusiveStartKey"];
      do {
        const page = await client.send(new QueryCommand({ TableName: table,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
          ExpressionAttributeValues: { ":pk": pk, ":prefix": prefix }, ConsistentRead: true, ExclusiveStartKey: cursor,
        }));
        items.push(...(page.Items ?? []));
        cursor = page.LastEvaluatedKey;
      } while (cursor);
      return items;
    }
    const products = await query("CATALOG", "PRODUCT#");
    const categories = await query("CATALOG", "CATEGORY#");
    const reviews = (await Promise.all(catalogue.products.map((product) => query(`PRODUCT#${product.id}`, "REVIEW#")))).flat();
    const actual = [...products, ...categories, ...reviews];
    if (actual.length !== records.length || records.some((record) =>
      !isDeepStrictEqual(actual.find((item) => item.pk === record.pk && item.sk === record.sk), record)))
      throw new Error("Consistent DynamoDB readback did not match the manifest.");
    const objects = z.object({ Contents: z.array(z.object({ Key: z.string() })).optional() }).parse(
      await aws("s3api", "list-objects-v2", "--bucket", manifest.bucket, "--prefix", "catalogue/"),
    );
    const receipt = { account: identity.Account, region: manifest.region, table, bucket: manifest.bucket,
      products: products.length, categories: categories.length, reviews: reviews.length,
      uploadedThisRun: uploaded, verifiedImageObjects: heads.length, cataloguePrefixObjects: objects.Contents?.length ?? 0,
      insertedThisRun: records.length - identicalRecords, identicalRecordsKept: identicalRecords,
      bucketPublicAccessBlocked: Object.values(privacy.PublicAccessBlockConfiguration).every(Boolean),
      objects: heads, verifiedAt: new Date().toISOString(),
    };
    await writeFile(join(directory, "cloud-verification.json"), `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(JSON.stringify({ ...receipt, objects: undefined }, null, 2));
  }
} finally {
  client.destroy();
}
