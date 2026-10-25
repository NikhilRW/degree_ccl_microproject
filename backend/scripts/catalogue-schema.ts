import { z } from "zod";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const image = z
  .string()
  .refine((s) => /^(https:\/\/|s3:\/\/)/.test(s), "Use an HTTPS image URL or s3://bucket/key.");
const productSchema = z
  .object({
    id,
    slug: id,
    name: z.string().min(1).max(150),
    category: z.string().min(1),
    categoryId: id,
    description: z.string().min(1).max(8000),
    highlights: z.array(z.string()).max(20),
    specifications: z.record(z.string(), z.string()),
    images: z.array(image).min(1).max(10),
    price: z.number().int().positive(),
    originalPrice: z.number().int().positive(),
    stock: z.number().int().nonnegative(),
    rating: z.number().min(0).max(5).default(0),
    reviewCount: z.number().int().nonnegative().default(0),
    featured: z.boolean().default(false),
    createdAt: z.string().datetime(),
    tags: z.array(z.string()).max(30),
  })
  .refine((p) => p.originalPrice >= p.price, "Original price must be at least the selling price.");

export const catalogueSchema = z.object({
  products: z.array(productSchema).max(5000),
  categories: z
    .array(z.object({ id, slug: id, name: z.string().min(1), description: z.string(), image }))
    .max(100),
  reviews: z
    .array(
      z.object({
        id,
        productId: id,
        author: z.string().min(1),
        rating: z.number().min(1).max(5),
        title: z.string(),
        body: z.string(),
        createdAt: z.string().datetime(),
      }),
    )
    .optional(),
});

export type Catalogue = z.infer<typeof catalogueSchema>;

export function validateCatalogue(value: unknown): Catalogue {
  const input = catalogueSchema.parse(value);
  const categoryIds = new Set(input.categories.map((c) => c.id));
  const productIds = new Set(input.products.map((p) => p.id));
  if (categoryIds.size !== input.categories.length || productIds.size !== input.products.length)
    throw new Error("Duplicate product/category IDs are not allowed.");
  for (const product of input.products) {
    if (!categoryIds.has(product.categoryId))
      throw new Error(`Unknown category ${product.categoryId} for ${product.id}.`);
    if (["featured", "price-range"].includes(product.id))
      throw new Error(`Reserved product ID: ${product.id}.`);
  }
  const reviewKeys = new Set<string>();
  for (const review of input.reviews ?? []) {
    if (!productIds.has(review.productId))
      throw new Error(`Unknown review product ${review.productId}.`);
    const key = `${review.productId}/${review.id}`;
    if (reviewKeys.has(key)) throw new Error(`Duplicate review key: ${key}.`);
    reviewKeys.add(key);
  }
  return input;
}

export function catalogueRecords(input: Catalogue) {
  return [
    ...input.products.map((data) => ({ pk: "CATALOG", sk: `PRODUCT#${data.id}`, data })),
    ...input.categories.map((data) => ({
      pk: "CATALOG",
      sk: `CATEGORY#${data.id}`,
      data: { ...data, productCount: input.products.filter((p) => p.categoryId === data.id).length },
    })),
    ...(input.reviews ?? []).map((data) => ({
      pk: `PRODUCT#${data.productId}`,
      sk: `REVIEW#${data.id}`,
      data,
    })),
  ];
}
