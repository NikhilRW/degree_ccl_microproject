/** Read-only AWS/public-RPC evidence collection. Only the ignored local report is written. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, parseArgs, promisify } from "node:util";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
// The installed frontend serializer is also used by TanStack's server-function protocol.
import { fromCrossJSON, toJSONAsync } from "seroval";
import { z } from "zod";
import { productQuerySchema } from "../../src/domain/contracts";
import { catalogueRecords, validateCatalogue } from "./catalogue-schema";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { values } = parseArgs({ options: { directory: { type: "string", default: ".local/catalogue-restore" } } });
const directory = resolve(values.directory);
const outputs = z.object({ IntelliMartBackend: z.object({
  StorefrontUrl: z.string().url(), MediaBucket: z.string(), Region: z.string(), TableName: z.string(),
}) }).parse(JSON.parse(await readFile(join(root, "backend/outputs.json"), "utf8"))).IntelliMartBackend;
const sourceBytes = await readFile(join(directory, "source-catalogue.json"));
const finalBytes = await readFile(join(directory, "catalogue.json"));
const source = validateCatalogue(JSON.parse(sourceBytes.toString("utf8")));
const final = validateCatalogue(JSON.parse(finalBytes.toString("utf8")));
const recordSchema = z.object({ pk: z.string(), sk: z.string(), data: z.record(z.string(), z.unknown()) });
type RecordItem = z.infer<typeof recordSchema>;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: outputs.Region, maxAttempts: 2 }));
async function query(pk: string, prefix: string): Promise<RecordItem[]> {
  const records: RecordItem[] = [];
  let cursor: ConstructorParameters<typeof QueryCommand>[0]["ExclusiveStartKey"];
  do {
    const page = await client.send(new QueryCommand({
      TableName: outputs.TableName, ConsistentRead: true,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: { ":pk": pk, ":prefix": prefix }, ExclusiveStartKey: cursor,
    }));
    records.push(...z.array(recordSchema).parse(page.Items ?? []));
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return records;
}
let products: RecordItem[];
let categories: RecordItem[];
let reviews: RecordItem[];
try {
  products = await query("CATALOG", "PRODUCT#");
  categories = await query("CATALOG", "CATEGORY#");
  reviews = [];
  for (const product of source.products) reviews.push(...await query(`PRODUCT#${product.id}`, "REVIEW#"));
} finally {
  client.destroy();
}
const actual = [...products, ...categories, ...reviews];
const expected = catalogueRecords(final);
const key = (record: { pk: string; sk: string }) => `${record.pk}/${record.sk}`;
const actualByKey = new Map(actual.map((record) => [key(record), record]));
if (actual.length !== expected.length || expected.some((record) => !isDeepStrictEqual(actualByKey.get(key(record)), record)))
  throw new Error("Actual cloud records differ from the final import manifest; refusing to report a match.");

const imageChanges: { kind: "product" | "category"; id: string; originalImages: string[]; storedImages: string[] }[] = [];
const photoAttributions: { productId: string; field: string; addedValue: string }[] = [];
const normalizedProducts = source.products.map((product) => {
  const data = recordSchema.parse(actualByKey.get(`CATALOG/PRODUCT#${product.id}`)).data;
  const specifications = z.record(z.string(), z.string()).parse(data.specifications);
  const { "Photo credit": credit, ...withoutCredit } = specifications;
  if (credit !== undefined) {
    if (!["p08", "p09"].includes(product.id)) throw new Error(`Unexpected photo attribution on ${product.id}.`);
    photoAttributions.push({ productId: product.id, field: "specifications.Photo credit", addedValue: credit });
  }
  const images = z.array(z.string()).parse(data.images);
  imageChanges.push({ kind: "product", id: product.id, originalImages: product.images, storedImages: images });
  return { ...data, images: product.images, specifications: credit === undefined ? specifications : withoutCredit };
});
const normalizedCategories = source.categories.map((category) => {
  const data = recordSchema.parse(actualByKey.get(`CATALOG/CATEGORY#${category.id}`)).data;
  const { productCount, ...withoutCount } = data;
  const derivedCount = source.products.filter((product) => product.categoryId === category.id).length;
  if (productCount !== derivedCount) throw new Error(`Incorrect derived productCount on ${category.id}.`);
  imageChanges.push({ kind: "category", id: category.id, originalImages: [category.image], storedImages: [z.string().parse(data.image)] });
  return { ...withoutCount, image: category.image };
});
const normalizedReviews = reviews.map((record) => record.data);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) => [name, canonical(item)]),
  );
  return value;
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const sorted = (items: Record<string, unknown>[]) => [...items].sort((a, b) => String(a.id).localeCompare(String(b.id)));
function comparison(original: Record<string, unknown>[], normalized: Record<string, unknown>[]) {
  const a = sorted(original);
  const b = sorted(normalized);
  if (!isDeepStrictEqual(a, b)) throw new Error("Source-to-cloud comparison failed outside the documented differences.");
  return { count: a.length, matchingRecords: b.length, allFieldsMatch: true,
    sourceSha256: digest(a), normalizedCloudSha256: digest(b),
    comparedFields: Object.keys(a[0] ?? {}).sort(),
  };
}
const comparisons = {
  products: comparison(source.products, normalizedProducts),
  categories: comparison(source.categories, normalizedCategories),
  reviews: comparison(source.reviews ?? [], normalizedReviews),
};
const storedImages = [...products.flatMap((record) => z.array(z.string()).parse(record.data.images)),
  ...categories.map((record) => z.string().parse(record.data.image))];
if (storedImages.some((url) => !url.startsWith(`s3://${outputs.MediaBucket}/catalogue/`)))
  throw new Error("An actual cloud image is not a stored reference into the intended media bucket.");
const sample = recordSchema.parse(actualByKey.get("CATALOG/PRODUCT#p01"));
const sampleUrl = new URL(z.array(z.string()).parse(sample.data.images)[0]);
const sampleObjectKey = decodeURIComponent(sampleUrl.pathname.slice(1));
const run = promisify(execFile);
const headArgs = ["s3api", "head-object", "--bucket", outputs.MediaBucket, "--key", sampleObjectKey,
  "--region", outputs.Region, "--output", "json", "--no-cli-pager"];
const head = JSON.parse((await run("aws", headArgs, { encoding: "utf8", timeout: 60000 })).stdout);
const objectEvidence = z.object({ ContentLength: z.number(), ContentType: z.string(),
  ServerSideEncryption: z.string(), Metadata: z.record(z.string(), z.string()),
}).parse(head);

// Capture the actual write-path source, not an invented baseline of unrelated table rows.
const scripts = dirname(fileURLToPath(import.meta.url));
const importer = await readFile(join(scripts, "import-catalogue.ts"), "utf8");
const publisher = await readFile(join(scripts, "publish-catalogue.ts"), "utf8");
const schema = await readFile(join(scripts, "catalogue-schema.ts"), "utf8");
function excerpt(text: string, pattern: RegExp, before: number, after: number) {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  if (index < 0) throw new Error("Expected write guard was not found in the operator source.");
  return lines.slice(Math.max(0, index - before), index + after + 1)
    .map((line, offset) => ({ line: Math.max(0, index - before) + offset + 1, code: line }));
}
const commands = (text: string) => [...new Set([...text.matchAll(/new (\w+Command)\(/g)].map((match) => match[1]))].sort();
if (!importer.includes('ConditionExpression: "attribute_not_exists(pk)"') ||
  !publisher.includes('"--skip-identical"') || publisher.includes('"--overwrite"') ||
  !isDeepStrictEqual(commands(importer), ["GetCommand", "PutCommand"]) ||
  !isDeepStrictEqual(commands(publisher), ["GetCommand", "QueryCommand"]))
  throw new Error("Operator write-path guards differ from the documented conditional import.");

const proof = {
  verifiedAt: new Date().toISOString(), awsMutationsPerformed: false,
  readMethod: "Consistent DynamoDB QueryCommand reads: CATALOG/PRODUCT#, CATALOG/CATEGORY#, and REVIEW# in the twenty PRODUCT#id partitions; one S3 HeadObject.",
  sourceFileSha256: createHash("sha256").update(sourceBytes).digest("hex"),
  finalManifestSha256: createHash("sha256").update(finalBytes).digest("hex"),
  actualRecordsMatchingFinalManifest: actual.length,
  comparisons,
  normalization: "For source comparison only: restore original image URLs, remove the two added Photo credit specifications, and remove derived category productCount. Every other field, including IDs, prices, stock and all review fields, is compared exactly. Actual images are NOT claimed to be unchanged.",
  intentionalDifferences: { images: imageChanges, photoAttributions,
    categoryCounts: categories.map((record) => ({ id: record.data.id, productCount: record.data.productCount })),
    replacements: [
      { productId: "p08", reason: "Mouse/laptop originals replaced with a licensed illustrative laptop-stand photo." },
      { productId: "p09", reason: "Dead primary and keyboard alternate replaced with a licensed illustrative USB-C hub photo." },
    ],
  },
  actualStoredSample: { table: outputs.TableName, key: { pk: sample.pk, sk: sample.sk }, item: sample },
  storedImageReferences: { total: storedImages.length, unique: new Set(storedImages).size, allUseExpectedS3Bucket: true },
  sampleS3Object: { bucket: outputs.MediaBucket, key: sampleObjectKey, head: objectEvidence,
    exactReadCommand: ["aws", ...headArgs].join(" "),
  },
  preservationEvidence: {
    intendedKeyCount: expected.length, exactKeys: expected.map(key).sort(), keysetSha256: digest(expected.map(key).sort()),
    baselineLimitation: "The earlier observed baseline was zero CATALOG rows only. No before/after baseline was captured for unrelated partitions; preservation is supported by the bounded key constructor, conditional puts, identical-record checks and absence of deletes, not an invented full-table comparison.",
    importerCommandTypes: commands(importer), publisherCommandTypes: commands(publisher),
    overwrite: "The generic importer exposes --overwrite, but the publisher does not pass it. Its actual invocation uses --skip-identical; different records are refused and existing identical records are only read/skipped.",
    keyConstructor: { file: "backend/scripts/catalogue-schema.ts", lines: excerpt(schema, /export function catalogueRecords/, 0, 14) },
    conditionalPut: { file: "backend/scripts/import-catalogue.ts", lines: excerpt(importer, /ConditionExpression/, 4, 3) },
    identicalGuard: { file: "backend/scripts/import-catalogue.ts", lines: excerpt(importer, /if \(values\["skip-identical"\]\)/, 0, 12) },
    publisherInvocation: { file: "backend/scripts/publish-catalogue.ts", lines: excerpt(publisher, /const result = await run\(process.execPath/, 0, 5) },
    noDynamoDBDeleteOrUserOrderKeyConstructorInThisWritePath: true,
  },
};
const previous = z.record(z.string(), z.unknown()).parse(JSON.parse(await readFile(join(directory, "cloud-verification.json"), "utf8")));
await writeFile(join(directory, "cloud-verification.json"), `${JSON.stringify({ ...previous, sourceToCloudEvidence: proof }, null, 2)}\n`);

// Never inspect SSR for client-useEffect product data. Use the real serializer and validator.
async function publicCheck() {
  const origin = new URL(outputs.StorefrontUrl).origin;
  let stage = "derive server-function IDs";
  const statuses: Record<string, number> = {};
  try {
    const ids = new Map<string, string>();
    const chunks = join(root, ".output/server/_ssr");
    for (const name of await readdir(chunks)) {
      if (!/^catalogue\.functions-.*\.mjs$/.test(name)) continue;
      const text = await readFile(join(chunks, name), "utf8");
      for (const match of text.matchAll(/var (productsFn|categoriesFn) =[^\n]+createSsrRpc\("([a-f0-9]+)"\)/g)) ids.set(match[1], match[2]);
    }
    const rpcValue = z.object({ ok: z.literal(true), value: z.array(z.record(z.string(), z.unknown())) });
    async function rpc(name: string, data?: unknown) {
      stage = name;
      const id = ids.get(name);
      if (!id) throw new Error("No matching server-function ID in the existing build.");
      const url = new URL(`${origin}/_serverFn/${id}`);
      if (data !== undefined) url.searchParams.set("payload", JSON.stringify(await toJSONAsync({ data })));
      const response = await fetch(url, { headers: { "x-tsr-serverFn": "true", accept: "application/json", origin }, signal: AbortSignal.timeout(30000) });
      statuses[name] = response.status;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const decoded: unknown = fromCrossJSON(await response.json(), {});
      const envelope = z.object({ result: z.unknown() }).safeParse(decoded);
      const value = rpcValue.safeParse(envelope.success ? envelope.data.result : decoded);
      if (!value.success) throw new Error("Decoded response did not contain a successful catalogue result.");
      return value.data.value;
    }
    const publicCategories = await rpc("categoriesFn");
    const input = productQuerySchema.parse({});
    const publicProducts = await rpc("productsFn", input);
    if (!isDeepStrictEqual(publicProducts.map((product) => product.id).sort(), source.products.map((product) => product.id).sort()) ||
      !isDeepStrictEqual(publicCategories.map((category) => category.id).sort(), source.categories.map((category) => category.id).sort()))
      throw new Error("RPC product/category ID sets differ from the source.");
    const url = new URL(z.array(z.string()).parse(publicProducts[0]?.images)[0]);
    if (!url.hostname.startsWith(`${outputs.MediaBucket}.s3.`) || !url.searchParams.has("X-Amz-Signature"))
      throw new Error("Product image was not a private-media presigned URL.");
    stage = "GET presigned product image";
    const image = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const bytes = (await image.arrayBuffer()).byteLength;
    if (image.status !== 200 || !bytes) throw new Error(`Image GET returned HTTP ${image.status}.`);
    return { verified: true, origin, statuses, products: publicProducts.length, categories: publicCategories.length,
      requestProtocol: "TanStack client protocol: Seroval toJSONAsync({data: productQuerySchema.parse({})}), GET payload query parameter, x-tsr-serverFn=true; Seroval fromCrossJSON response decoder. These catalogue payloads contain only ordinary JSON-compatible data and need no custom plugins.",
      image: { status: image.status, bytes, contentType: image.headers.get("content-type"), signedUrlRedacted: true },
      verifiedAt: new Date().toISOString(),
    };
  } catch (error) {
    // A network/protocol limitation is recorded explicitly; direct cloud evidence remains valid.
    const message = error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "[URL redacted]") : "Unknown probe failure";
    return { verified: false, origin, statuses, stage, limitation: message,
      directCloudVerificationPassed: true, verifiedAt: new Date().toISOString() };
  }
}
const live = await publicCheck();
await writeFile(join(directory, "live-verification.json"), `${JSON.stringify(live, null, 2)}\n`);
await writeFile(join(directory, "cloud-verification.json"), `${JSON.stringify({ ...previous, sourceToCloudEvidence: proof, publicCatalogueEvidence: live }, null, 2)}\n`);
console.log(JSON.stringify({
  awsMutationsPerformed: false, actualRecordsMatchingFinalManifest: actual.length, comparisons,
  actualStoredSample: { table: outputs.TableName, key: { pk: sample.pk, sk: sample.sk },
    id: sample.data.id, price: sample.data.price, stock: sample.data.stock, images: sample.data.images },
  storedImageReferences: proof.storedImageReferences,
  intendedWriteKeys: proof.preservationEvidence.intendedKeyCount,
  publicCatalogueEvidence: live,
  report: "backend/.local/catalogue-restore/cloud-verification.json",
}, null, 2));
