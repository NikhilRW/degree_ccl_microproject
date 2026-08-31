import type { Cart, CartTotals } from "@/types";

export interface CartService {
  getCart(): Promise<Cart>;
  addItem(productId: string, quantity?: number): Promise<Cart>;
  updateQuantity(productId: string, quantity: number): Promise<Cart>;
  removeItem(productId: string): Promise<Cart>;
  toggleSaveForLater(productId: string): Promise<Cart>;
  clear(): Promise<Cart>;
  calculateTotals(cart: Cart, delivery?: "standard" | "express"): CartTotals;
}
