import { changeCart, getShoppingState } from "@/server/shopping.functions";
import { mockCartService as guest } from "./mockCartService";
import { calculateTotals } from "@/server/pricing";
import type { CartService } from "./types";

export const cartService: CartService = {
  async getCart() {
    return (await getShoppingState())?.cart ?? guest.getCart();
  },
  async addItem(productId, quantity = 1) {
    return (await getShoppingState())
      ? changeCart({ data: { action: "add", productId, quantity } })
      : guest.addItem(productId, quantity);
  },
  async updateQuantity(productId, quantity) {
    return (await getShoppingState())
      ? changeCart({ data: { action: "quantity", productId, quantity } })
      : guest.updateQuantity(productId, quantity);
  },
  async removeItem(productId) {
    return (await getShoppingState())
      ? changeCart({ data: { action: "remove", productId } })
      : guest.removeItem(productId);
  },
  async toggleSaveForLater(productId) {
    return (await getShoppingState())
      ? changeCart({ data: { action: "save", productId } })
      : guest.toggleSaveForLater(productId);
  },
  async clear() {
    return (await getShoppingState()) ? changeCart({ data: { action: "clear" } }) : guest.clear();
  },
  calculateTotals,
};
