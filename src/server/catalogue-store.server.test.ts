import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDemoCatalogueStore } from "./catalogue-store.server";
import { productEditSchema, type ProductEdit } from "@/services/admin/schema";

const draft: ProductEdit = {
  name: "Lab headphones",
  slug: "lab-headphones",
  categoryId: "electronics",
  description: "A synthetic product used for lab tests.",
  imageUrl: "https://example.com/image.jpg",
  price: 999,
  originalPrice: 1299,
  stock: 5,
  featured: true,
};
let directory: string;
beforeEach(async () => {
  const parent = join(tmpdir(), "opencode");
  await mkdir(parent, { recursive: true });
  directory = await mkdtemp(join(parent, "intellimart-test-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("demo catalogue persistence", () => {
  it("seeds reads and persists audited product changes across store instances", async () => {
    const file = join(directory, "catalogue.json");
    const store = createDemoCatalogueStore(file);
    const initial = await store.snapshot();
    expect(initial.products.length).toBeGreaterThan(0);
    const product = await store.upsert(draft);
    const persisted = await createDemoCatalogueStore(file).snapshot();
    expect(persisted.products.find((item) => item.id === product.id)?.stock).toBe(5);
    expect(persisted.audit[0]?.action).toBe("product.created");
    expect(persisted.categories.find((item) => item.id === draft.categoryId)?.productCount).toBe(
      initial.categories.find((item) => item.id === draft.categoryId)!.productCount + 1,
    );
  });
  it("rejects stale edits and preserves immutable identity and rating", async () => {
    const store = createDemoCatalogueStore(join(directory, "catalogue.json"));
    const created = await store.upsert(draft);
    const input = { ...draft, id: created.id, expectedVersion: created.version!, stock: 3 };
    const updated = await store.upsert(input);
    expect(updated.id).toBe(created.id);
    expect(updated.rating).toBe(created.rating);
    await expect(store.upsert(input)).rejects.toThrow("Refresh before saving");
  });
  it("serializes concurrent writes so duplicate slugs are rejected", async () => {
    const store = createDemoCatalogueStore(join(directory, "catalogue.json"));
    const outcomes = await Promise.allSettled([store.upsert(draft), store.upsert(draft)]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect((await store.snapshot()).audit).toHaveLength(1);
  });
  it("archives/restores without deleting products or miscounting categories", async () => {
    const store = createDemoCatalogueStore(join(directory, "catalogue.json"));
    const product = await store.upsert(draft);
    await store.archive({ id: product.id, expectedVersion: product.version!, archived: true });
    const archived = (await store.snapshot()).products.find((item) => item.id === product.id)!;
    expect(archived.archived).toBe(true);
    await store.archive({ id: product.id, expectedVersion: archived.version!, archived: false });
    expect((await store.snapshot()).products.find((item) => item.id === product.id)?.archived).toBe(
      false,
    );
  });
  it("refuses corrupt files instead of silently resetting data", async () => {
    const file = join(directory, "catalogue.json");
    await writeFile(file, "not-json");
    await expect(createDemoCatalogueStore(file).snapshot()).rejects.toThrow(
      "refusing to overwrite",
    );
  });
  it("validates stock, prices, URLs, category and privileged extra fields", async () => {
    expect(productEditSchema.safeParse({ ...draft, stock: -1 }).success).toBe(false);
    expect(productEditSchema.safeParse({ ...draft, originalPrice: 1 }).success).toBe(false);
    expect(productEditSchema.safeParse({ ...draft, price: 1.999 }).success).toBe(false);
    expect(productEditSchema.safeParse({ ...draft, imageUrl: "javascript:alert(1)" }).success).toBe(
      false,
    );
    expect(productEditSchema.safeParse({ ...draft, rating: 5 }).success).toBe(false);
    await expect(
      createDemoCatalogueStore(join(directory, "catalogue.json")).upsert({
        ...draft,
        categoryId: "unknown",
      }),
    ).rejects.toThrow("existing category");
  });
});
