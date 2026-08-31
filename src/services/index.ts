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
export { notificationService } from "./notifications";
export { analyticsService } from "./analytics";
export { paymentService } from "./payments";
export { searchService } from "./search";
export { apiClient } from "./api/apiClient";
