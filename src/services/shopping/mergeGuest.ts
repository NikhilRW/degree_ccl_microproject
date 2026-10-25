import { mergeGuestShopping } from "@/server/shopping.functions";
import { readLocal, writeLocal } from "../serviceUtils";
import type { WishlistItem } from "@/types";

export async function mergeGuestData() {
  const cart = readLocal<{ productId: string; quantity: number; savedForLater?: boolean }[]>(
    "intellimart.cart",
    [],
  );
  const wishlist = readLocal<WishlistItem[]>("intellimart.wishlist", []);
  if (!cart.length && !wishlist.length) return;
  const mergeId = readLocal<string | null>("intellimart.merge", null) ?? crypto.randomUUID();
  writeLocal("intellimart.merge", mergeId);
  await mergeGuestShopping({ data: { mergeId, cart, wishlist } });
  writeLocal("intellimart.cart", []);
  writeLocal("intellimart.wishlist", []);
  writeLocal("intellimart.merge", null);
}
