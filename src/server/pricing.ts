import type { Cart, CartTotals, DeliveryMethod, Product } from "@/types";

export function toPaise(rupees: number): number {
  const paise = Math.round(rupees * 100);
  if (
    !Number.isFinite(rupees) ||
    rupees < 0 ||
    !Number.isSafeInteger(paise) ||
    Math.abs(rupees * 100 - paise) > 0.000001
  )
    throw new Error("Invalid price precision.");
  return paise;
}
export function calculateTotals(cart: Cart, delivery: DeliveryMethod = "standard"): CartTotals {
  const active = cart.items.filter((item) => !item.savedForLater);
  const subtotal = active.reduce(
    (total, item) => total + toPaise(item.product.price) * item.quantity,
    0,
  );
  const discount = active.reduce(
    (total, item) =>
      total +
      Math.max(0, toPaise(item.product.originalPrice) - toPaise(item.product.price)) *
        item.quantity,
    0,
  );
  const shipping =
    subtotal === 0 ? 0 : delivery === "express" ? 49900 : subtotal > 2000000 ? 0 : 19900;
  const tax = Math.round((subtotal * 18) / 100);
  const total = subtotal + shipping + tax;
  if (!Number.isSafeInteger(total) || total > 1000000000)
    throw new Error("Checkout exceeds the lab order limit.");
  return {
    subtotal: subtotal / 100,
    discount: discount / 100,
    shipping: shipping / 100,
    tax: tax / 100,
    total: total / 100,
  };
}
export function validateQuantity(product: Product, quantity: number) {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 99 ||
    quantity > product.stock ||
    product.archived
  )
    throw new Error(`Invalid quantity or insufficient stock for ${product.name}.`);
}
