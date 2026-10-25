import type { CartService } from "./types";
import { cartFn, changeCartFn } from "@/functions/customer.functions";
import { unwrap } from "../rpc";
import { calculateCartTotals } from "@/domain/cartTotals";

export const cartService: CartService = {
  getCart: () => unwrap(() => cartFn()),
  addItem: (productId, quantity = 1) => unwrap(() => changeCartFn({ data: { action: "add", productId, quantity } })),
  updateQuantity: (productId, quantity) => unwrap(() => changeCartFn({ data: { action: "quantity", productId, quantity } })),
  removeItem: productId => unwrap(() => changeCartFn({ data: { action: "remove", productId } })),
  toggleSaveForLater: productId => unwrap(() => changeCartFn({ data: { action: "saved", productId } })),
  clear: () => unwrap(() => changeCartFn({ data: { action: "clear" } })),
  calculateTotals: calculateCartTotals,
};
