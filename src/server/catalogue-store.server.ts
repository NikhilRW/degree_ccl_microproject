import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { products as seedProducts, reviews } from "@/data/products";
import { categories as seedCategories } from "@/data/categories";
import type { Category, Product } from "@/types";
import { archiveProductSchema, productEditSchema, type ProductEdit } from "@/services/admin/schema";

// Only synthetic catalogue data is stored here. A single-process local demo
// store is not a substitute for DynamoDB, multi-instance concurrency or IAM.
const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  categoryId: z.string(),
  description: z.string(),
  highlights: z.array(z.string()),
  specifications: z.record(z.string()),
  images: z.array(z.string()),
  price: z.number().finite().nonnegative(),
  originalPrice: z.number().finite().nonnegative(),
  rating: z.number(),
  reviewCount: z.number(),
  stock: z.number().int().nonnegative(),
  featured: z.boolean(),
  createdAt: z.string(),
  tags: z.array(z.string()),
  archived: z.boolean().optional(),
  version: z.number().int().nonnegative().optional(),
});
const stateSchema = z.object({
  schemaVersion: z.literal(1),
  products: z.array(productSchema),
  audit: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      actor: z.literal("demo-operator"),
      action: z.string(),
      productId: z.string(),
    }),
  ),
});
type CatalogueState = z.infer<typeof stateSchema>;

export function createDemoCatalogueStore(file: string) {
  const path = resolve(file);
  let pending: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const result = pending.then(work, work);
    pending = result.catch(() => undefined);
    return result;
  };

  async function load(): Promise<CatalogueState> {
    try {
      return stateSchema.parse(JSON.parse(await readFile(path, "utf8")));
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return { schemaVersion: 1, products: structuredClone(seedProducts), audit: [] };
      }
      throw new Error(
        "Cannot read the demo catalogue. Back up and inspect the data file; refusing to overwrite corrupted data.",
        { cause: error },
      );
    }
  }

  async function save(state: CatalogueState, productId: string, action: string) {
    state.audit.unshift({
      id: randomUUID(),
      at: new Date().toISOString(),
      actor: "demo-operator",
      action,
      productId,
    });
    // Keep the local demonstration file bounded. Cloud audit retention is a separate design.
    state.audit = state.audit.slice(0, 200);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(temporary, path);
  }

  return {
    snapshot: () =>
      exclusive(async () => {
        const state = await load();
        const categories: Category[] = seedCategories.map((category) => ({
          ...category,
          productCount: state.products.filter(
            (product) => !product.archived && product.categoryId === category.id,
          ).length,
        }));
        return {
          products: state.products as Product[],
          categories,
          reviews: structuredClone(reviews),
          audit: state.audit,
        };
      }),
    upsert: (raw: ProductEdit) =>
      exclusive(async () => {
        const input = productEditSchema.parse(raw);
        const state = await load();
        const category = seedCategories.find((item) => item.id === input.categoryId);
        if (!category) throw new Error("Choose an existing category.");
        const current = input.id
          ? state.products.find((product) => product.id === input.id)
          : undefined;
        if (input.id && !current) throw new Error("Product not found.");
        if (current && (current.version ?? 0) !== input.expectedVersion)
          throw new Error("This product changed. Refresh before saving.");
        if (
          state.products.some(
            (product) => product.slug === input.slug && product.id !== current?.id,
          )
        )
          throw new Error("A product already uses this slug.");
        const product: Product = {
          id: current?.id ?? `p_${randomUUID()}`,
          slug: input.slug,
          name: input.name,
          category: category.name,
          categoryId: category.id,
          description: input.description,
          highlights: current?.highlights ?? [],
          specifications: current?.specifications ?? {},
          images: [input.imageUrl, ...(current?.images.slice(1) ?? [])],
          price: input.price,
          originalPrice: input.originalPrice,
          stock: input.stock,
          featured: input.featured,
          rating: current?.rating ?? 0,
          reviewCount: current?.reviewCount ?? 0,
          createdAt: current?.createdAt ?? new Date().toISOString(),
          tags: current?.tags ?? [category.id],
          archived: current?.archived ?? false,
          version: (current?.version ?? 0) + 1,
        };
        state.products = current
          ? state.products.map((item) => (item.id === product.id ? product : item))
          : [...state.products, product];
        await save(state, product.id, current ? "product.updated" : "product.created");
        return product;
      }),
    archive: (raw: z.infer<typeof archiveProductSchema>) =>
      exclusive(async () => {
        const input = archiveProductSchema.parse(raw);
        const state = await load();
        const product = state.products.find((item) => item.id === input.id);
        if (!product) throw new Error("Product not found.");
        if ((product.version ?? 0) !== input.expectedVersion)
          throw new Error("This product changed. Refresh before saving.");
        product.archived = input.archived;
        product.version = (product.version ?? 0) + 1;
        await save(state, product.id, input.archived ? "product.archived" : "product.restored");
      }),
  };
}
