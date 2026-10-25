import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as shopping from "./shopping.server";
import { idSchema } from "./validation";

export const getShoppingState = createServerFn({ method: "GET" }).handler(() =>
  shopping.shoppingState(),
);
export const changeCart = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        action: z.enum(["add", "quantity", "remove", "save", "clear"]),
        productId: idSchema.optional(),
        quantity: z.number().int().min(0).max(99).optional(),
      })
      .strict()
      .refine((data) => data.action === "clear" || !!data.productId, "A product is required")
      .refine(
        (data) => !["add", "quantity"].includes(data.action) || data.quantity !== undefined,
        "A quantity is required",
      )
      .parse(raw),
  )
  .handler(({ data }) => shopping.mutateCart(data));
export const changeWishlist = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({ productId: idSchema, remove: z.boolean() }).strict().parse(raw),
  )
  .handler(({ data }) => shopping.mutateWishlist(data.productId, data.remove));
export const mergeGuestShopping = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        mergeId: z.string().uuid(),
        cart: z
          .array(
            z
              .object({
                productId: idSchema,
                quantity: z.number().int().min(1).max(99),
                savedForLater: z.boolean().optional(),
              })
              .strict(),
          )
          .max(20),
        wishlist: z
          .array(z.object({ productId: idSchema, addedAt: z.string().datetime() }).strict())
          .max(100),
      })
      .strict()
      .parse(raw),
  )
  .handler(({ data }) => shopping.mergeShopping(data));
