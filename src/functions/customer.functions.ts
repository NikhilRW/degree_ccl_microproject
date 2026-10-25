import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  analyticsSchema,
  cartChangeSchema,
  fileSchema,
  idSchema,
  orderSchema,
  uploadSchema,
} from "../domain/contracts";
import * as customer from "../server/customer.server";
import { requireSession } from "../server/session.server";
import { authenticated, rpc } from "../server/rpc.server";

export const customerMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const authentication = await rpc(requireSession);
  return next({ context: { authentication } }); // Server context only, not sendContext.
});
export const cartFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .handler(({ context }) => authenticated(context.authentication, customer.getCart));
export const changeCartFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .validator(cartChangeSchema)
  .handler(({ context, data }) =>
    authenticated(context.authentication, (user) => customer.changeCart(user, data)),
  );
export const wishlistFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .handler(({ context }) => authenticated(context.authentication, customer.listWishlist));
export const changeWishlistFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .validator(z.object({ productId: idSchema, remove: z.boolean() }))
  .handler(({ context, data }) =>
    authenticated(context.authentication, (user) =>
      customer.changeWishlist(user, data.productId, data.remove),
    ),
  );
export const ordersFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .handler(({ context }) => authenticated(context.authentication, customer.listOrders));
export const orderFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .validator(idSchema)
  .handler(({ context, data }) =>
    authenticated(context.authentication, (user) => customer.getOrder(user, data)),
  );
export const createOrderFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .validator(orderSchema)
  .handler(({ context, data }) =>
    authenticated(context.authentication, (user) => customer.createOrder(user, data)),
  );
export const cancelOrderFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .validator(idSchema)
  .handler(({ context, data }) =>
    authenticated(context.authentication, (user) => customer.cancelOrder(user, data)),
  );
export const uploadFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .validator(uploadSchema)
  .handler(({ context, data }) =>
    authenticated(context.authentication, (user) => customer.uploadFile(user, data)),
  );
export const fileFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .validator(fileSchema)
  .handler(({ context, data }) =>
    authenticated(context.authentication, (user) => customer.accessFile(user, data)),
  );
export const analyticsFn = createServerFn({ method: "POST" })
  .middleware([customerMiddleware])
  .validator(analyticsSchema)
  .handler(({ context, data }) =>
    authenticated(context.authentication, (user) => customer.recordAnalytics(user, data)),
  );
