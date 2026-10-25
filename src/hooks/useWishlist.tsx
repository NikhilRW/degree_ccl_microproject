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
<<<<<<< HEAD
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { wishlistService } from "@/services";
import { authGeneration, isCurrentAuthGeneration } from "@/services/rpc";
=======
import { toast } from "sonner";
import { readLocal, writeLocal } from "@/services/serviceUtils";
import { changeWishlist, getShoppingState } from "@/server/shopping.functions";
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
import { useAuth } from "./useAuth";
import type { WishlistItem } from "@/types";

interface WishlistContextValue {
  items: WishlistItem[];
<<<<<<< HEAD
  has(id: string): boolean;
  toggle(id: string): void;
  remove(id: string): void;
}
const WishlistContext = createContext<WishlistContextValue | null>(null);
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const pending = useRef(new Set<string>());
  useEffect(() => {
    let cancelled = false;
    const generation = authGeneration();
    pending.current = new Set<string>();
    setItems([]);
    if (!user || loading) return;
    wishlistService
      .list()
      .then((value) => {
        if (!cancelled && isCurrentAuthGeneration(generation)) setItems(value);
      })
      .catch((error) => {
        if (!cancelled && isCurrentAuthGeneration(generation))
          toast.error(error instanceof Error ? error.message : "Could not load your wishlist.");
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading]);
  const change = useCallback(
    async (id: string, save: boolean) => {
      if (!user) {
        toast("Sign in to save your favourites.");
        void navigate({ to: "/login" });
        return;
      }
      const generation = authGeneration();
      const pendingRequests = pending.current;
      if (pendingRequests.has(id)) return;
      pendingRequests.add(id);
      try {
        const value = await (save ? wishlistService.save(id) : wishlistService.remove(id));
        if (!isCurrentAuthGeneration(generation)) return;
        setItems(value);
        toast(save ? "Saved to wishlist" : "Removed from wishlist");
      } catch (error) {
        if (isCurrentAuthGeneration(generation))
          toast.error(error instanceof Error ? error.message : "Could not update your wishlist.");
      } finally {
        pendingRequests.delete(id);
      }
    },
    [user?.id, navigate],
  );
  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      has: (id) => items.some((item) => item.productId === id),
      toggle: (id) => {
        void change(id, !items.some((item) => item.productId === id));
      },
      remove: (id) => {
        void change(id, false);
      },
    }),
    [items, change],
=======
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
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
  );
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
export function useWishlist() {
<<<<<<< HEAD
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used inside WishlistProvider");
  return value;
=======
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside WishlistProvider");
  return context;
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
}
