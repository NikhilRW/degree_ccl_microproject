import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, requireUser } from "./auth.server";
import { getRecords } from "./records.server";
import {
  categorySchema,
  saveCategory,
  listCustomers,
  setCustomerEnabled,
  submitReview,
  moderateReview,
} from "./admin.server";
import { idSchema, reviewSchema } from "./validation";
import { updateOrderStatus, reconcileOrder } from "./orders.server";
import { runMaintenance } from "./maintenance.server";
import { beginImageUpload, completeImageUpload, MAX_IMAGE_BYTES } from "./media.server";
import type { Order, Review } from "@/types";

export const getAdminOrders = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  return (await getRecords().list<Order>("ORDER"))
    .map((row) => row.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});
export const setAdminOrderStatus = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        id: idSchema,
        status: z.enum(["shipped", "delivered", "cancelled"]),
        expectedVersion: z.number().int().nonnegative(),
      })
      .strict()
      .parse(raw),
  )
  .handler(async ({ data }) =>
    updateOrderStatus(data.id, data.status, data.expectedVersion, await requireAdmin()),
  );
export const reconcileAdminOrder = createServerFn({ method: "POST" })
  .validator((raw: unknown) => idSchema.parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    await reconcileOrder(data);
  });
export const runAdminMaintenance = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  await runMaintenance();
});
export const saveAdminCategory = createServerFn({ method: "POST" })
  .validator((raw: unknown) => categorySchema.parse(raw))
  .handler(async ({ data }) => saveCategory(data, await requireAdmin()));
export const getAdminCustomers = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.string().max(4096).optional().parse(raw))
  .handler(async ({ data }) => {
    await requireAdmin();
    return listCustomers(data);
  });
export const toggleAdminCustomer = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z.object({ username: idSchema, enabled: z.boolean() }).strict().parse(raw),
  )
  .handler(async ({ data }) =>
    setCustomerEnabled(data.username, data.enabled, await requireAdmin()),
  );
export const getAdminReviews = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  return (await getRecords().list<Review>("REVIEW")).map((row) => row.value);
});
export const setAdminReview = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({ id: idSchema, status: z.enum(["approved", "rejected"]) })
      .strict()
      .parse(raw),
  )
  .handler(async ({ data }) => moderateReview(data.id, data.status, await requireAdmin()));
export const createCustomerReview = createServerFn({ method: "POST" })
  .validator((raw: unknown) => reviewSchema.parse(raw))
  .handler(async ({ data }) => submitReview(data, await requireUser()));
export const startImageUpload = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        type: z.enum(["image/jpeg", "image/png", "image/webp"]),
        size: z.number().int().positive().max(MAX_IMAGE_BYTES),
      })
      .strict()
      .parse(raw),
  )
  .handler(async ({ data }) => beginImageUpload(data.type, data.size, await requireAdmin()));
export const finishImageUpload = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.string().uuid().parse(raw))
  .handler(async ({ data }) => completeImageUpload(data, await requireAdmin()));
