import { createServerFn } from "@tanstack/react-start";
import { adminOrdersSchema, adminOrderStatusSchema, createProductSchema, productUploadSchema, updatePriceSchema } from "../domain/contracts";
import * as admin from "../server/admin.server";
import * as adminOrders from "../server/admin-orders.server";
import { rpc } from "../server/rpc.server";

// Authorization lives in every server operation, not in the route or client.
export const adminAccessFn = createServerFn({ method: "POST" }).handler(() => rpc(admin.access));
export const adminProductsFn = createServerFn({ method: "POST" }).handler(() => rpc(admin.listProducts));
export const adminUploadFn = createServerFn({ method: "POST" }).validator(productUploadSchema)
  .handler(({ data }) => rpc(() => admin.uploadImage(data)));
export const adminCreateProductFn = createServerFn({ method: "POST" }).validator(createProductSchema)
  .handler(({ data }) => rpc(() => admin.createProduct(data)));
export const adminUpdatePriceFn = createServerFn({ method: "POST" }).validator(updatePriceSchema)
  .handler(({ data }) => rpc(() => admin.updatePrice(data)));
export const adminOrdersFn = createServerFn({ method: "POST" }).validator(adminOrdersSchema)
  .handler(({ data }) => rpc(() => adminOrders.listOrders(data)));
export const adminOrderStatusFn = createServerFn({ method: "POST" }).validator(adminOrderStatusSchema)
  .handler(({ data }) => rpc(() => adminOrders.updateOrderStatus(data)));
