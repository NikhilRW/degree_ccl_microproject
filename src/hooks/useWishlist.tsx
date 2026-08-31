import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { readLocal, writeLocal } from "@/services/serviceUtils";
import type { WishlistItem } from "@/types";

/** AWS LEARNING ZONE: move to a DynamoDB `Wishlist` table keyed by user id. */
const KEY = "intellimart.wishlist";

interface WishlistContextValue {
  items: WishlistItem[];
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => setItems(readLocal<WishlistItem[]>(KEY, [])), []);

  const persist = useCallback((next: WishlistItem[]) => {
    setItems(next);
    writeLocal(KEY, next);
  }, []);

  const toggle = useCallback(
    (productId: string) => {
      const exists = items.some((i) => i.productId === productId);
      persist(exists ? items.filter((i) => i.productId !== productId) : [...items, { productId, addedAt: new Date().toISOString() }]);
      toast(exists ? "Removed from wishlist" : "Saved to wishlist");
    },
    [items, persist],
  );

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      has: (id) => items.some((i) => i.productId === id),
      toggle,
      remove: (id) => persist(items.filter((i) => i.productId !== id)),
    }),
    [items, toggle, persist],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside WishlistProvider");
  return ctx;
}
