import { changeWishlistFn, wishlistFn } from "@/functions/customer.functions";
import { unwrap } from "../rpc";

export const wishlistService = {
  list: () => unwrap(() => wishlistFn()),
  save: (productId: string) => unwrap(() => changeWishlistFn({ data: { productId, remove: false } })),
  remove: (productId: string) => unwrap(() => changeWishlistFn({ data: { productId, remove: true } })),
};
