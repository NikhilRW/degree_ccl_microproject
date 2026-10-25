import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { cartService } from "@/services";
import { authGeneration, isCurrentAuthGeneration } from "@/services/rpc";
import { useAuth } from "./useAuth";
import type { Cart, DeliveryMethod } from "@/types";

interface CartContextValue {
  cart: Cart;
  loading: boolean;
  count: number;
  add(productId: string, quantity?: number): Promise<boolean>;
  update(productId: string, quantity: number): Promise<void>;
  remove(productId: string): Promise<void>;
  toggleSaveForLater(productId: string): Promise<void>;
  clear(): Promise<void>;
  refresh(): Promise<void>;
  totals(delivery?: DeliveryMethod): ReturnType<typeof cartService.calculateTotals>;
  drawerOpen: boolean;
  setDrawerOpen(open: boolean): void;
}
const CartContext = createContext<CartContextValue | null>(null);
const empty: Cart = { items: [], updatedAt: "" };

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart>(empty);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    const generation = authGeneration();
    setCart(empty);
    setDrawerOpen(false);
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    cartService
      .getCart()
      .then((value) => {
        if (!cancelled && isCurrentAuthGeneration(generation)) setCart(value);
      })
      .catch((error) => {
        if (!cancelled && isCurrentAuthGeneration(generation))
          toast.error(error instanceof Error ? error.message : "Could not load your bag.");
      })
      .finally(() => {
        if (!cancelled && isCurrentAuthGeneration(generation)) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);
  const mutate = useCallback(
    async (operation: () => Promise<Cart>, message?: string) => {
      if (!user) {
        toast("Sign in to use your shopping bag.");
        void navigate({ to: "/login" });
        return false;
      }
      const generation = authGeneration();
      try {
        const value = await operation();
        if (!isCurrentAuthGeneration(generation)) return false;
        setCart(value);
        if (message) toast.success(message);
        return true;
      } catch (error) {
        if (isCurrentAuthGeneration(generation))
          toast.error(error instanceof Error ? error.message : "Could not update your bag.");
        return false;
      }
    },
    [user?.id, navigate],
  );
  const add = useCallback(
    async (id: string, quantity = 1) => {
      const success = await mutate(() => cartService.addItem(id, quantity), "Added to bag");
      if (success) setDrawerOpen(true);
      return success;
    },
    [mutate],
  );
  const update = useCallback(
    async (id: string, quantity: number) => {
      await mutate(() => cartService.updateQuantity(id, quantity));
    },
    [mutate],
  );
  const remove = useCallback(
    async (id: string) => {
      await mutate(() => cartService.removeItem(id), "Removed from bag");
    },
    [mutate],
  );
  const toggleSaveForLater = useCallback(
    async (id: string) => {
      await mutate(() => cartService.toggleSaveForLater(id));
    },
    [mutate],
  );
  const clear = useCallback(async () => {
    await mutate(() => cartService.clear());
  }, [mutate]);
  const refresh = useCallback(async () => {
    await mutate(() => cartService.getCart());
  }, [mutate]);
  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      count: cart.items
        .filter((item) => !item.savedForLater)
        .reduce((sum, item) => sum + item.quantity, 0),
      add,
      update,
      remove,
      toggleSaveForLater,
      clear,
      refresh,
      totals: (delivery = "standard") => cartService.calculateTotals(cart, delivery),
      drawerOpen,
      setDrawerOpen,
    }),
    [cart, loading, add, update, remove, toggleSaveForLater, clear, refresh, drawerOpen],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
