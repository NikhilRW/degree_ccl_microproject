import { z } from "zod";

const money = z
  .number()
  .finite()
  .nonnegative()
  .max(10000000)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
    "Use at most two decimal places",
  );

export const productEditSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    expectedVersion: z.number().int().nonnegative().optional(),
    name: z.string().trim().min(2).max(150),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
    categoryId: z.string().min(1).max(100),
    description: z.string().trim().min(10).max(5000),
    imageUrl: z
      .string()
      .url()
      .max(2000)
      .refine((url) => new URL(url).protocol === "https:", "Use an HTTPS image URL"),
    price: money,
    originalPrice: money,
    stock: z.number().int().min(0).max(100000),
    featured: z.boolean(),
    additionalImages: z
      .array(
        z
          .string()
          .url()
          .max(2000)
          .refine((url) => new URL(url).protocol === "https:", "Use HTTPS image URLs"),
      )
      .max(9)
      .optional(),
    highlights: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
    specifications: z
      .record(z.string().min(1).max(80), z.string().max(500))
      .refine(
        (values) =>
          Object.keys(values).length <= 30 &&
          !Object.keys(values).some((key) =>
            ["__proto__", "constructor", "prototype"].includes(key),
          ),
        "Use at most 30 ordinary specification keys",
      )
      .optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  })
  .strict()
  .refine((input) => input.originalPrice >= input.price, {
    message: "Original price cannot be lower than sale price",
    path: ["originalPrice"],
  })
  .refine((input) => !input.id || input.expectedVersion !== undefined, {
    message: "An existing product requires its current version",
    path: ["expectedVersion"],
  });

export type ProductEdit = z.infer<typeof productEditSchema>;

export const archiveProductSchema = z
  .object({
    id: z.string().min(1).max(100),
    expectedVersion: z.number().int().nonnegative(),
    archived: z.boolean(),
  })
  .strict();

export const productQuerySchema = z
  .object({
    search: z.string().max(200).optional(),
    categories: z.array(z.string().max(100)).max(30).optional(),
    minPrice: money.optional(),
    maxPrice: money.optional(),
    minRating: z.number().min(0).max(5).optional(),
    sort: z.enum(["featured", "price-asc", "price-desc", "rating", "newest"]).optional(),
  })
  .strict();
