import type { ProductService } from "./types";
import { categoriesFn, priceRangeFn, productFn, productsFn, relatedFn, reviewsFn } from "@/functions/catalogue.functions";
import { unwrap } from "../rpc";

export const productService: ProductService = {
  list: (query = {}) => unwrap(() => productsFn({ data: query }), false),
  getById: id => unwrap(() => productFn({ data: id }), false),
  getFeatured: (limit = 8) => unwrap(() => productsFn({ data: { featured: true, limit } }), false),
  getRelated: (id, limit = 4) => unwrap(() => relatedFn({ data: { id, limit } }), false),
  getCategories: () => unwrap(() => categoriesFn(), false),
  getReviews: id => unwrap(() => reviewsFn({ data: id }), false),
  getPriceRange: () => unwrap(() => priceRangeFn(), false),
};
