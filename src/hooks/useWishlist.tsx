import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { readLocal, writeLocal } from "@/services/serviceUtils";
import { changeWishlist, getShoppingState } from "@/server/shopping.functions";
import { useAuth } from "./useAuth";
import type { WishlistItem } from "@/types";

interface WishlistContextValue {
  items: WishlistItem[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
}
const WishlistContext = createContext<WishlistContextValue | null>(null);
const KEY = "intellimart.wishlist";
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const identity = useRef<string | null>(null);
  identity.current = user?.id ?? null;
  const busy = useRef(false);
  useEffect(() => {
    if (loading) return;
    let active = true;
    setItems([]);
    if (!user) setItems(readLocal<WishlistItem[]>(KEY, []));
    else
      void getShoppingState()
        .then((state) => {
          if (active) setItems(state?.wishlist ?? []);
        })
        .catch(() => toast.error("Could not load wishlist"));
    return () => {
      active = false;
    };
  }, [user?.id, loading, user]);
  const change = useCallback(
    async (id: string, remove: boolean) => {
      if (busy.current) return;
      busy.current = true;
      const owner = identity.current;
      try {
        let next: WishlistItem[];
        if (owner) next = await changeWishlist({ data: { productId: id, remove } });
        else {
          next = items.filter((item) => item.productId !== id);
          if (!remove) next.push({ productId: id, addedAt: new Date().toISOString() });
          writeLocal(KEY, next);
        }
        if (identity.current === owner) setItems(next);
        toast(remove ? "Removed from wishlist" : "Saved to wishlist");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Wishlist update failed");
      } finally {
        busy.current = false;
      }
    },
    [items],
  );
  const toggle = useCallback(
    (id: string) => {
      void change(
        id,
        items.some((item) => item.productId === id),
      );
    },
    [change, items],
  );
  const remove = useCallback(
    (id: string) => {
      void change(id, true);
    },
    [change],
  );
  const value = useMemo(
    () => ({
      items,
      has: (id: string) => items.some((item) => item.productId === id),
      toggle,
      remove,
    }),
    [items, toggle, remove],
  );
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside WishlistProvider");
  return context;
}
