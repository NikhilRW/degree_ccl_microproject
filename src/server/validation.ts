import { z } from "zod";

export const idSchema = z.string().min(1).max(200);
export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());
export const addressSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .min(7)
      .max(20)
      .refine(
        (value) => /^(?:\+91)?[6-9][0-9]{9}$/.test(value.replace(/[ ()-]/g, "")),
        "Enter a valid Indian mobile number",
      ),
    address: z.string().trim().min(5).max(250),
    apartment: z.string().trim().max(100).optional(),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    postalCode: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{5}$/, "Enter a six-digit Indian PIN code"),
    country: z.literal("India"),
  })
  .strict();
export const profileSchema = z
  .object({ name: z.string().trim().min(2).max(100), addresses: z.array(addressSchema).max(5) })
  .strict();
export const checkoutSchema = z
  .object({
    address: addressSchema,
    delivery: z.enum(["standard", "express"]),
    method: z.enum(["card", "upi", "cod"]),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const reviewSchema = z
  .object({
    productId: idSchema,
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().min(3).max(100),
    body: z.string().trim().min(10).max(2000),
  })
  .strict();
