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
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { wishlistService } from "@/services";
import { authGeneration, isCurrentAuthGeneration } from "@/services/rpc";
import { useAuth } from "./useAuth";
import type { WishlistItem } from "@/types";

interface WishlistContextValue {
  items: WishlistItem[];
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
  );
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used inside WishlistProvider");
  return value;
}
