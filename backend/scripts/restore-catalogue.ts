/** Operator-only recovery of the historical SAMPLE catalogue. Never used by the app.
 * This script performs local writes and public photo downloads, NEVER AWS calls.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createContext, Script } from "node:vm";
import { transform } from "esbuild";
import { z } from "zod";
import { catalogueRecords, validateCatalogue } from "./catalogue-schema";
import { assetSchema, uploadManifestSchema, type Asset } from "./catalogue-assets";
import { photoReplacements } from "./catalogue-photo-replacements";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { values } = parseArgs({
  options: {
    ref: { type: "string" },
    outputs: { type: "string", default: join(root, "backend/outputs.json") },
    bucket: { type: "string" },
    region: { type: "string" },
    out: { type: "string", default: join(root, "backend/.local/catalogue-restore") },
  },
});
if (!values.ref)
  throw new Error("Usage: npm run restore:catalogue -- --ref TRUSTED_GIT_REF [--out DIRECTORY] [--outputs outputs.json] [--bucket BUCKET --region REGION]");

const output = resolve(values.out);
const imagesDirectory = join(output, "images");
const outputsSchema = z.record(z.string(), z.object({
  MediaBucket: z.string(),
  Region: z.string(),
  TableName: z.string(),
}));
const outputs = values.bucket && values.region ? undefined : outputsSchema.parse(
  JSON.parse(await readFile(values.outputs, "utf8")),
).IntelliMartBackend;
const bucket = z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/).parse(values.bucket ?? outputs?.MediaBucket);
const region = z.string().min(1).parse(values.region ?? outputs?.Region);
const git = (...args: string[]) => execFileSync("git", args, {
  cwd: root, encoding: "utf8", maxBuffer: 2 * 1024 * 1024,
});
const commit = z.string().regex(/^[a-f0-9]{40,64}$/).parse(
  git("rev-parse", "--verify", "--end-of-options", `${values.ref}^{commit}`).trim(),
);

async function recover(path: string): Promise<Record<string, unknown>> {
  // Only run code from an explicitly chosen, TRUSTED Git ref. VM is not a security boundary.
  // esbuild removes type-only @/ imports, leaving the original objects/review generator intact.
  const source = git("show", `${commit}:${path}`);
  const { code } = await transform(source, {
    loader: "ts", format: "cjs", platform: "node", target: "node22", sourcefile: path,
  });
  const module = { exports: {} };
  const context = createContext({ module, exports: module.exports }, {
    codeGeneration: { strings: false, wasm: false },
  });
  new Script(code, { filename: `${commit}:${path}` }).runInContext(context, { timeout: 1000 });
  return z.record(z.string(), z.unknown()).parse(module.exports);
}

const productModule = await recover("src/data/products.ts");
const categoryModule = await recover("src/data/categories.ts");
const original = validateCatalogue({
  products: productModule.products,
  categories: categoryModule.categories,
  reviews: productModule.reviews,
});
if (original.products.length !== 20 || original.categories.length !== 8 || original.reviews?.length !== 80)
  throw new Error("Expected the historical SAMPLE catalogue: 20 products, 8 categories, 80 reviews.");
for (const product of original.products) {
  if (original.reviews.filter((review) => review.productId === product.id).length !== 4)
    throw new Error(`Expected four SAMPLE reviews for ${product.id}.`);
}

const illustrated = {
  ...original,
  products: original.products.map((product) => {
    const replacement = photoReplacements.find((photo) => photo.productId === product.id);
    if (!replacement) return product;
    return {
      ...product,
      images: [replacement.url],
      specifications: {
        ...product.specifications,
        "Photo credit": `Illustrative product-family photo: "${replacement.title}" by ${replacement.author}, ${replacement.license}. Source: ${replacement.page} License: ${replacement.licenseUrl} Original image, unmodified.`,
      },
    };
  }),
};

// Exact photo-ID provenance from .taste-skill/download-assets.mjs. In particular,
// hub.jpg is the old ALTERNATE (a keyboard), not the missing primary hub photo.
const localPhotos: Record<string, string> = {
  "photo-1505740420928-5e560c06d30e": "headphones-yellow",
  "photo-1583394838336-acd977736f90": "headphones-detail",
  "photo-1484704849700-f032a568e944": "headphones-dark",
  "photo-1541140532154-b024d705b90a": "keyboard",
  "photo-1523275335684-37898b6baf30": "watch",
  "photo-1527443224154-c4a3942d3acf": "monitor",
  "photo-1527864550417-7fd91fc51a46": "mouse",
  "photo-1543512214-318c7553f230": "speaker",
  "photo-1590658268037-6bf12165a8df": "earbuds",
  "photo-1507473885765-e6ed057f782c": "lamp",
  "photo-1592840496694-26d035b52b48": "controller",
  "photo-1580480055273-228ff5388ef8": "chair",
  "photo-1495474472287-4d71bcdd2085": "coffee",
  "photo-1502920917128-1aa500764cbd": "camera",
  "photo-1553062407-98eeb64c6a62": "backpack",
  "photo-1542291026-7eec264c27ff": "sneakers",
  "photo-1512820790803-83ca734da794": "books",
  "photo-1473968512647-3e447244af8f": "drone",
  "photo-1498049794561-7780e7231661": "electronics",
  "photo-1517336714731-489689fd1ca8": "computing",
  "photo-1493809842364-78817add7ffb": "home",
  "photo-1483985988355-763728e1935b": "fashion",
  "photo-1542751371-adc38448a05e": "gaming",
  "photo-1558089687-f282ffcbc126": "smart",
  "photo-1625948515291-69613efd103f": "hub",
  "photo-1597872200969-2b65d56bd16b": "ssd",
  "photo-1511499767150-a48a237f0083": "sunglasses",
};

type Reference = { kind: "product" | "category"; id: string; index: number; url: string };
type Photo = { id: string; urls: Set<string>; references: Reference[] };
const photos = new Map<string, Photo>();
function photoId(value: string) {
  const replacement = photoReplacements.find((photo) => photo.url === value);
  if (replacement) return replacement.id;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "images.unsplash.com" ||
    !/^\/photo-[a-zA-Z0-9-]+$/.test(url.pathname))
    throw new Error(`Not an original Unsplash photo URL: ${value}`);
  return url.pathname.slice(1);
}
function register(reference: Reference) {
  const id = photoId(reference.url);
  const photo = photos.get(id) ?? { id, urls: new Set<string>(), references: [] };
  photo.urls.add(reference.url);
  photo.references.push(reference);
  photos.set(id, photo);
}
for (const product of illustrated.products)
  product.images.forEach((url, index) => register({ kind: "product", id: product.id, index, url }));
for (const category of original.categories)
  register({ kind: "category", id: category.id, index: 0, url: category.image });

type Unresolved = { photoId: string; sourceUrls: string[]; references: Reference[]; error: string };
const assets = new Map<string, Asset>();
const unresolved: Unresolved[] = [];
const maxBytes = 8 * 1024 * 1024;
function assertJpeg(bytes: Buffer) {
  if (bytes.length < 4 || bytes.length > maxBytes ||
    bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff ||
    bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9)
    throw new Error("Expected a complete JPEG of at most 8 MiB; refusing mislabeled/invalid content.");
}
async function existing(path: string) {
  try { return await readFile(path); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}
async function download(photo: Photo) {
  const widths = [...photo.urls].map((url) => Number(new URL(url).searchParams.get("w")) || 800);
  const url = new URL(`https://images.unsplash.com/${photo.id}`);
  url.search = new URLSearchParams({ fm: "jpg", fit: "crop", w: String(Math.max(...widths)), q: "80" }).toString();
  const replacement = photoReplacements.find((item) => item.id === photo.id);
  const response = await fetch(replacement?.url ?? url, {
    signal: AbortSignal.timeout(20000), redirect: "error",
    headers: { "User-Agent": "IntelliMart-catalogue-migration/1.0" },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Original photo download returned HTTP ${response.status}.`);
  }
  if (!response.headers.get("content-type")?.startsWith("image/jpeg") ||
    Number(response.headers.get("content-length") ?? 0) > maxBytes) {
    await response.body?.cancel();
    throw new Error("Download was not a JPEG of at most 8 MiB.");
  }
  if (!response.body) throw new Error("Empty photo response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Photo exceeded 8 MiB.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

await mkdir(imagesDirectory, { recursive: true });
// Invalidate a previous ready file before doing any further preparation.
await rm(join(output, "catalogue.json"), { force: true });
async function prepare(photo: Photo) {
  try {
    const filename = `${photo.id}.jpg`;
    const path = join(imagesDirectory, filename);
    let source: Asset["source"] = "prepared-cache";
    let bytes = await existing(path);
    if (!bytes) {
      const localName = localPhotos[photo.id];
      const localPath = localName ? join(root, "public/images", `${localName}.jpg`) : undefined;
      bytes = localPath ? await existing(localPath) : undefined;
      if (bytes && localPath) {
        assertJpeg(bytes);
        await copyFile(localPath, path);
        source = "local";
      } else {
        bytes = await download(photo);
        assertJpeg(bytes);
        await writeFile(path, bytes);
        source = "download";
      }
    }
    assertJpeg(bytes);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const key = `catalogue/${filename}`;
    const replacement = photoReplacements.find((item) => item.id === photo.id);
    assets.set(photo.id, assetSchema.parse({
      photoId: photo.id,
      key,
      s3Url: `s3://${bucket}/${key}`,
      relativePath: `images/${filename}`,
      contentType: "image/jpeg",
      cacheControl: "private, max-age=300",
      bytes: bytes.length,
      sha256,
      source,
      sourceUrls: [...photo.urls],
      metadata: {
        source: replacement ? "wikimedia-commons" : "unsplash",
        "photo-id": photo.id, sha256, "content-class": "sample-catalogue",
        ...(replacement ? { author: replacement.author, license: replacement.license, "license-url": replacement.licenseUrl, "source-page": replacement.page } : {}),
      },
    }));
    console.log(`Prepared ${photo.id} (${source})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    unresolved.push({ photoId: photo.id, sourceUrls: [...photo.urls], references: photo.references, error: message });
    console.log(`UNRESOLVED ${photo.id}: ${message}`);
  }
}
// Bounded parallel downloads; a missing original is reported, never replaced with unrelated stock.
const queue = [...photos.values()];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const photo = queue.shift();
    if (photo) await prepare(photo);
  }
}));

const mapped = (url: string) => assets.get(photoId(url))?.s3Url;
const draft = {
  ...illustrated,
  products: illustrated.products.map((product) => ({
    ...product,
    images: product.images.map(mapped).filter((url): url is string => url !== undefined),
  })),
  categories: original.categories.map((category) => ({ ...category, image: mapped(category.image) ?? "" })),
};
let schemaValid = false;
let validationError: string | undefined;
try {
  validateCatalogue(draft);
  schemaValid = true;
} catch (error) {
  validationError = error instanceof Error ? error.message : String(error);
}
// Every S3 reference in the draft must have a matching, hash-verified local upload asset.
const assetUrls = new Set([...assets.values()].map((asset) => asset.s3Url));
for (const url of [...draft.products.flatMap((product) => product.images), ...draft.categories.map((category) => category.image)]) {
  if (url && !assetUrls.has(url)) throw new Error(`Unprepared image reference: ${url}`);
}
for (const asset of assets.values()) {
  const bytes = await readFile(join(output, asset.relativePath));
  assertJpeg(bytes);
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
    throw new Error(`Prepared photo hash mismatch: ${asset.photoId}`);
}
const ready = schemaValid && unresolved.length === 0;
const uploadManifest = uploadManifestSchema.parse({
  version: 1, classification: "SAMPLE", sourceCommit: commit, bucket, region,
  tableName: outputs?.TableName, importReady: ready,
  assets: [...assets.values()].sort((a, b) => a.photoId.localeCompare(b.photoId)),
});
const counts = {
  products: original.products.length, categories: original.categories.length,
  reviews: original.reviews.length, records: catalogueRecords(original).length,
  uniquePhotos: photos.size, preparedPhotos: assets.size, unresolvedPhotos: unresolved.length,
};
async function json(name: string, value: unknown) {
  await writeFile(join(output, name), `${JSON.stringify(value, null, 2)}\n`);
}
await json("source-catalogue.json", original);
await json("catalogue.draft.json", draft);
await json("upload-manifest.json", uploadManifest);
await json("readiness.json", {
  classification: "SAMPLE", sourceCommit: commit, importReady: ready, schemaValid,
  validationError, counts, unresolved: unresolved.sort((a, b) => a.photoId.localeCompare(b.photoId)),
  replacements: photoReplacements, awsCallsMade: false,
  notes: [
    "Historical product rating/reviewCount values are preserved; they are SAMPLE aggregates, not counts of these four generated reviews per product.",
    "The dead USB-hub photo and mismatched hub/stand images are replaced with credited, openly licensed illustrative product-family photos. No sample-data approval gate applies.",
    "S3 URLs are planned destinations, NOT uploaded objects. Upload all prepared photos before any DynamoDB import.",
    "Original Unsplash photo URLs are retained as provenance. Commons photo attribution/license URLs are included in product specifications and S3 metadata.",
    "Only products/categories/reviews are recovered. No auth users, carts, orders, sessions or runtime mock fallbacks are created.",
  ],
});
if (ready) await json("catalogue.json", validateCatalogue(draft));
await writeFile(join(output, "README.txt"), [
  "SAMPLE catalogue recovery - LOCAL PREPARATION ONLY",
  `Source commit: ${commit}`,
  `Import ready: ${ready}; schema valid: ${schemaValid}`,
  "Read readiness.json before doing anything with AWS.",
  "catalogue.json is the final import manifest when importReady is true.",
  "Upload and verify every referenced image before importing the records.",
  "upload-manifest.json records local relative paths, S3 keys, content metadata and SHA-256 hashes.",
  "No AWS calls were made by this utility. Planned S3 URLs do not exist until separately uploaded.",
  "",
].join("\n"));
console.log(JSON.stringify({ output: relative(root, output), sourceCommit: commit, importReady: ready, schemaValid, counts }, null, 2));
if (!ready) console.log("BLOCKED: inspect readiness.json. No ready catalogue.json was emitted. Do not import the draft.");
