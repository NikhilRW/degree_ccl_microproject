import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUser } from "./auth.server";
import { checkoutSchema, idSchema } from "./validation";
import * as orders from "./orders.server";

export const getMyOrders = createServerFn({ method: "GET" }).handler(async () =>
  orders.listCustomerOrders((await requireUser()).id),
);
export const getMyOrder = createServerFn({ method: "GET" })
  .validator((raw: unknown) => idSchema.parse(raw))
  .handler(async ({ data }) => (await orders.ownedOrder(data, await requireUser())).value);
export const createCheckout = createServerFn({ method: "POST" })
  .validator((raw: unknown) => checkoutSchema.parse(raw))
  .handler(async ({ data }) => orders.beginCheckout(data, await requireUser()));
export const confirmCheckout = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({ orderId: idSchema, paymentId: z.string().max(100), signature: z.string().max(128) })
      .strict()
      .parse(raw),
  )
  .handler(async ({ data }) =>
    orders.verifyCheckout(data.orderId, data.paymentId, data.signature, await requireUser()),
  );
export const cancelMyOrder = createServerFn({ method: "POST" })
  .validator((raw: unknown) => idSchema.parse(raw))
  .handler(async ({ data }) => orders.cancelOrder(data, await requireUser()));
export const resumeMyCheckout = createServerFn({ method: "POST" })
  .validator((raw: unknown) => idSchema.parse(raw))
  .handler(async ({ data }) => orders.resumeCheckout(data, await requireUser()));
export const reconcileMyOrder = createServerFn({ method: "POST" })
  .validator((raw: unknown) => idSchema.parse(raw))
  .handler(async ({ data }) => {
    await orders.ownedOrder(data, await requireUser());
    await orders.reconcileOrder(data);
    return (await orders.ownedOrder(data, await requireUser())).value;
  });
