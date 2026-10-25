import { z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED") {
    super(message);
  }
}
export type RpcResult<T> = { ok: true; value: T } | {
  ok: false; error: { status: number; code: string; message: string };
};
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const email = z.email().max(254);
const password = z.string().min(10).max(256);
const code = z.string().min(4).max(12);
export const loginSchema = z.object({ email, password: z.string().min(1).max(256) });
export const signupSchema = z.object({ name: z.string().trim().min(1).max(100), email, password });
export const emailSchema = z.object({ email });
export const confirmationSchema = z.object({ email, code });
export const resetSchema = z.object({ email, code, password });
export const productQuerySchema = z.object({
  search: z.string().max(200).optional(), categories: z.array(idSchema).max(100).optional(),
  minPrice: z.number().finite().nonnegative().optional(),
  maxPrice: z.number().finite().nonnegative().optional(),
  minRating: z.number().min(0).max(5).optional(),
  sort: z.enum(["featured", "price-asc", "price-desc", "rating", "newest"]).optional(),
  featured: z.boolean().optional(), limit: z.number().int().min(1).max(100).optional(),
});
export const cartChangeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), productId: idSchema, quantity: z.number().int().min(1).max(99) }),
  z.object({ action: z.literal("quantity"), productId: idSchema, quantity: z.number().int().min(0).max(99) }),
  z.object({ action: z.literal("remove"), productId: idSchema }),
  z.object({ action: z.literal("saved"), productId: idSchema }),
  z.object({ action: z.literal("clear") }),
]);
export const orderSchema = z.object({
  address: z.object({
    fullName: z.string().trim().min(1).max(100), phone: z.string().trim().min(7).max(25),
    address: z.string().trim().min(1).max(300), apartment: z.string().max(200).optional(),
    city: z.string().trim().min(1).max(100), state: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(3).max(15), country: z.string().refine(value => value === "India", "Delivery is available in India only."),
  }),
  delivery: z.enum(["standard", "express"]), method: z.literal("cod"),
  expectedTotal: z.number().int().nonnegative(), idempotencyKey: z.uuid(),
});
export const uploadSchema = z.object({
  name: z.string().min(1).max(200), contentType: z.string().max(100).refine(
    value => ["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"].includes(value),
    "Unsupported file type.",
  ), size: z.number().int().min(1).max(5 * 1024 * 1024),
});
export const fileSchema = z.object({ key: z.string().min(1).max(1024), remove: z.boolean() });
export const analyticsSchema = z.object({
  event: z.string().regex(/^[a-zA-Z0-9_.-]{1,80}$/),
  properties: z.record(z.string().max(100), z.union([
    z.string().max(500), z.number().finite(), z.boolean(), z.null(),
  ])).optional(),
});

const rupees = z.number().int().min(1).max(100_000_000);
export const productImageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const productImageMaxBytes = 5 * 1024 * 1024;
export const productUploadSchema = z.object({
  contentType: z.enum(productImageTypes), size: z.number().int().min(1).max(productImageMaxBytes),
}).strict();
export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200), categoryId: idSchema,
  description: z.string().trim().min(1).max(5000), price: rupees,
  originalPrice: rupees.optional(), stock: z.number().int().min(0).max(1_000_000),
  images: z.array(z.string().min(1).max(300)).min(1).max(6),
}).strict().refine(value => (value.originalPrice ?? value.price) >= value.price, {
  message: "List price must be at least the selling price.", path: ["originalPrice"],
}).refine(value => new Set(value.images).size === value.images.length, {
  message: "Each product image must be different.", path: ["images"],
});
export const updatePriceSchema = z.object({
  productId: idSchema, price: rupees, originalPrice: rupees,
  expectedPrice: rupees, expectedOriginalPrice: rupees,
}).strict().refine(value => value.originalPrice >= value.price, {
  message: "List price must be at least the selling price.", path: ["originalPrice"],
});
export const reviewSchema = z.object({
  productId: idSchema, rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(2000),
}).strict();

export const orderStatuses = ["processing", "shipped", "delivered", "cancelled"] as const;
export const orderStatusSchema = z.enum(orderStatuses);
export const adminOrderCursorSchema = z.object({ ownerId: idSchema, orderId: idSchema }).strict();
export const adminOrdersSchema = z.object({ cursor: adminOrderCursorSchema.optional() }).strict();
export const adminOrderStatusSchema = z.object({
  ownerId: idSchema, orderId: idSchema, expectedStatus: orderStatusSchema, status: orderStatusSchema,
}).strict();
