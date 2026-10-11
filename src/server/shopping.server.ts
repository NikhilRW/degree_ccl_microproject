import type { Cart, Category, Product, WishlistItem } from "@/types";
import { change, getRecords, retryConflict } from "./records.server";
import { getCurrentSession, requireUser } from "./auth.server";
import { validateQuantity } from "./pricing";

export interface StoredCartItem {
  productId: string;
  quantity: number;
  savedForLater?: boolean | undefined;
}
export async function hydrateCart(items: StoredCartItem[]): Promise<Cart> {
  const products = await Promise.all(
    items.map((item) => getRecords().get<Product>("PRODUCT", item.productId)),
  );
  const categories = await getRecords().list<Category>("CATEGORY");
  return {
    items: items.flatMap((item, index) => {
      const product = products[index]?.value;
      return product &&
        !product.archived &&
        categories.some(
          (category) => category.id === product.categoryId && !category.value.archived,
        )
        ? [{ ...item, product }]
        : [];
    }),
    updatedAt: new Date().toISOString(),
  };
}
export async function shoppingState() {
  const session = await getCurrentSession();
  if (!session) return null;
  const [cart, wishlist] = await Promise.all([
    getRecords().get<StoredCartItem[]>("CART", session.user.id),
    getRecords().get<WishlistItem[]>("WISHLIST", session.user.id),
  ]);
  return { cart: await hydrateCart(cart?.value ?? []), wishlist: wishlist?.value ?? [] };
}
export async function mutateCart(input: {
  action: "add" | "quantity" | "remove" | "save" | "clear";
  productId?: string | undefined;
  quantity?: number | undefined;
}): Promise<Cart> {
  const user = await requireUser();
  return retryConflict(async () => {
    const row = await getRecords().get<StoredCartItem[]>("CART", user.id);
    let items = structuredClone(row?.value ?? []);
    if (input.action === "clear") items = [];
    else {
      const index = items.findIndex((item) => item.productId === input.productId);
      if (input.action === "remove" || (input.action === "quantity" && input.quantity === 0))
        items = items.filter((item) => item.productId !== input.productId);
      else if (input.action === "save") {
        if (index < 0) throw new Error("Cart item not found.");
        items[index]!.savedForLater = !items[index]!.savedForLater;
      } else {
        const product = await getRecords().get<Product>("PRODUCT", input.productId!);
        if (!product) throw new Error("Product not found.");
        const category = await getRecords().get<Category>("CATEGORY", product.value.categoryId);
        if (!category || category.value.archived)
          throw new Error("Product category is unavailable.");
        const quantity =
          input.action === "add"
            ? (items[index]?.quantity ?? 0) + (input.quantity ?? 1)
            : input.quantity!;
        validateQuantity(product.value, quantity);
        if (index >= 0) items[index]!.quantity = quantity;
        else items.push({ productId: product.id, quantity });
      }
    }
    if (items.length > 20) throw new Error("The lab cart supports at most 20 different products.");
    await getRecords().transaction([change("CART", user.id, row, items)]);
    return hydrateCart(items);
  });
}
export async function mutateWishlist(productId: string, remove: boolean) {
  const user = await requireUser();
  return retryConflict(async () => {
    const row = await getRecords().get<WishlistItem[]>("WISHLIST", user.id);
    const items = (row?.value ?? []).filter((item) => item.productId !== productId);
    if (!remove) {
      const product = await getRecords().get<Product>("PRODUCT", productId);
      if (!product || product.value.archived) throw new Error("Product is unavailable.");
      items.push({ productId, addedAt: new Date().toISOString() });
    }
    if (items.length > 100) throw new Error("Wishlist limit reached.");
    await getRecords().transaction([change("WISHLIST", user.id, row, items)]);
    return items;
  });
}
export async function mergeShopping(input: {
  mergeId: string;
  cart: StoredCartItem[];
  wishlist: WishlistItem[];
}) {
  const user = await requireUser();
  // A stable batch ID prevents retries duplicating quantities without discarding
  // an identical guest cart created at a later date.
  const digest = input.mergeId;
  await retryConflict(async () => {
    if (await getRecords().get("MERGE", `${user.id}#${digest}`)) return;
    const cartRow = await getRecords().get<StoredCartItem[]>("CART", user.id);
    const wishlistRow = await getRecords().get<WishlistItem[]>("WISHLIST", user.id);
    const items = structuredClone(cartRow?.value ?? []);
    for (const guest of input.cart) {
      const product = await getRecords().get<Product>("PRODUCT", guest.productId);
      if (!product || product.value.archived || product.value.stock < 1) continue;
      const existing = items.find((item) => item.productId === guest.productId);
      const quantity = Math.min(
        99,
        product.value.stock,
        (existing?.quantity ?? 0) + guest.quantity,
      );
      if (existing) existing.quantity = quantity;
      else if (items.length < 20) items.push({ ...guest, quantity });
    }
    const wishlist = [...(wishlistRow?.value ?? [])];
    for (const item of input.wishlist)
      if (
        wishlist.length < 100 &&
        !wishlist.some((existing) => existing.productId === item.productId)
      ) {
        const product = await getRecords().get<Product>("PRODUCT", item.productId);
        if (product && !product.value.archived) wishlist.push(item);
      }
    await getRecords().transaction([
      change("CART", user.id, cartRow, items),
      change("WISHLIST", user.id, wishlistRow, wishlist),
      {
        kind: "MERGE",
        id: `${user.id}#${digest}`,
        expected: null,
        value: { expiresAt: Date.now() + 30 * 86400000 },
      },
    ]);
  });
  return shoppingState();
}
