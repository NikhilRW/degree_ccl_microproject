import type { Cart, CartTotals } from "@/types";
import { products } from "@/data/products";
import { readLocal, writeLocal } from "../serviceUtils";
import type { CartService } from "./types";

const KEY = "intellimart.cart";
type StoredItem = { productId: string; quantity: number; savedForLater?: boolean };

function hydrate(stored: StoredItem[]): Cart {
  return {
    items: stored
      .map((s) => {
        const product = products.find((p) => p.id === s.productId);
        return product ? { ...s, product } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    updatedAt: new Date().toISOString(),
  };
}

function read(): StoredItem[] { return readLocal<StoredItem[]>(KEY, []); }
function write(items: StoredItem[]): Cart { writeLocal(KEY, items); return hydrate(items); }

/**
 * AWS LEARNING ZONE — cart persistence boundary.
 * Today: localStorage (guest cart).
 * Later: DynamoDB `Cart` table keyed by Cognito sub, written through Lambda.
 * `calculateTotals` should eventually be a Lambda (`calculateCart`) so pricing
 * and tax rules cannot be tampered with in the browser.
 */
export const mockCartService: CartService = {
  async getCart() { return hydrate(read()); },
  async addItem(productId, quantity = 1) {
    const items = read();
    const existing = items.find((i) => i.productId === productId);
    if (existing) existing.quantity += quantity;
    else items.push({ productId, quantity });
    return write(items);
  },
  async updateQuantity(productId, quantity) {
    let items = read();
    if (quantity <= 0) items = items.filter((i) => i.productId !== productId);
    else items = items.map((i) => (i.productId === productId ? { ...i, quantity } : i));
    return write(items);
  },
  async removeItem(productId) { return write(read().filter((i) => i.productId !== productId)); },
  async toggleSaveForLater(productId) {
    return write(read().map((i) => (i.productId === productId ? { ...i, savedForLater: !i.savedForLater } : i)));
  },
  async clear() { return write([]); },
  calculateTotals(cart, delivery = "standard"): CartTotals {
    const active = cart.items.filter((i) => !i.savedForLater);
    const subtotal = active.reduce((s, i) => s + i.product.price * i.quantity, 0);
    const discount = active.reduce((s, i) => s + (i.product.originalPrice - i.product.price) * i.quantity, 0);
    const shipping = subtotal === 0 ? 0 : delivery === "express" ? 499 : subtotal > 20000 ? 0 : 199;
    const tax = Math.round(subtotal * 0.18);
    return { subtotal, discount, shipping, tax, total: subtotal + shipping + tax };
  },
};

export const cartService: CartService = mockCartService;
