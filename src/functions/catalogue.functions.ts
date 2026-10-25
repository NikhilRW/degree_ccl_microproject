import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { idSchema, productQuerySchema } from "../domain/contracts";
import * as catalogue from "../server/catalogue.server";
import { rpc } from "../server/rpc.server";

export const productsFn = createServerFn({ method: "GET" }).validator(productQuerySchema)
  .handler(({ data }) => rpc(() => catalogue.list(data)));
export const productFn = createServerFn({ method: "GET" }).validator(idSchema)
  .handler(({ data }) => rpc(() => catalogue.detail(data)));
export const categoriesFn = createServerFn({ method: "GET" }).handler(() => rpc(catalogue.categories));
export const reviewsFn = createServerFn({ method: "GET" }).validator(idSchema)
  .handler(({ data }) => rpc(() => catalogue.reviews(data)));
export const relatedFn = createServerFn({ method: "GET" }).validator(z.object({ id: idSchema, limit: z.number().int().min(1).max(100) }))
  .handler(({ data }) => rpc(() => catalogue.related(data.id, data.limit)));
export const priceRangeFn = createServerFn({ method: "GET" }).handler(() => rpc(catalogue.priceRange));
export const suggestionsFn = createServerFn({ method: "GET" }).validator(z.string().max(200))
  .handler(({ data }) => rpc(() => catalogue.suggestions(data)));
