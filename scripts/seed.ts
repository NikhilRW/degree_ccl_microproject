import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { products, reviews } from "../src/data/products";
import { categories } from "../src/data/categories";
import { getRecords, change } from "../src/server/records.server";
import { getRuntimeConfig } from "../src/server/runtime.server";

if (existsSync(".env")) loadEnvFile(".env");
const config = getRuntimeConfig();
const records = getRecords();
let created = 0;
for (const category of categories) {
  if (!(await records.get("CATEGORY", category.id))) {
    await records.transaction([change("CATEGORY", category.id, null, { ...category, version: 1 })]);
    created++;
  }
}
for (const product of products) {
  if (!(await records.get("PRODUCT", product.id))) {
    const slug = await records.get("PRODUCT_SLUG", product.slug);
    if (slug)
      throw new Error(`Seed slug conflict for ${product.id}; no existing product was overwritten.`);
    await records.transaction([
      change("PRODUCT", product.id, null, { ...product, version: 1 }),
      change("PRODUCT_SLUG", product.slug, null, { productId: product.id }),
    ]);
    created++;
  }
}
for (const review of reviews)
  if (!(await records.get("REVIEW", review.id))) {
    await records.transaction([
      change("REVIEW", review.id, null, { ...review, status: "approved" }),
    ]);
    created++;
  }
console.log(
  `Seed complete (${config.mode}): ${created} new synthetic catalogue records. Existing data was not overwritten; no cloud customer accounts or sample orders were created.`,
);
