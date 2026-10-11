/**
 * Single import surface for the whole service layer.
 *
 * AWS BOUNDARY RULE: components import from here (or from a hook), never from
 * `src/data/*` and never from an AWS SDK directly.
 *   Component -> Service -> (Mock today | AWS tomorrow)
 */
export { authService } from "./auth";
export { productService } from "./products";
export { cartService } from "./cart";
export { orderService } from "./orders";
export { storageService } from "./storage";
export { analyticsService } from "./analytics";
export { searchService } from "./search";
