import type { Cart, CartTotals, DeliveryMethod } from "../types";

/** Display estimates and authoritative server totals share the same pricing rules. */
export function calculateCartTotals(cart: Cart, delivery: DeliveryMethod = "standard"): CartTotals {
  const active = cart.items.filter((item) => !item.savedForLater);
  const subtotal = active.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const discount = active.reduce(
    (sum, item) =>
      sum + Math.max(0, item.product.originalPrice - item.product.price) * item.quantity,
    0,
  );
  const shipping = subtotal === 0 ? 0 : delivery === "express" ? 499 : subtotal > 20000 ? 0 : 199;
  const tax = Math.round(subtotal * 0.18);
  return { subtotal, discount, shipping, tax, total: subtotal + shipping + tax };
}
