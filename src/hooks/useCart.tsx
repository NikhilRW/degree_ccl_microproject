import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cartService } from "@/services";
import type { Cart, DeliveryMethod } from "@/types";

/**
 * Cart state lives in React + localStorage today.
 * AWS LEARNING ZONE: swap `cartService` for an AWS-backed implementation and
 * this hook keeps working unchanged (server-side persistence per Cognito user).
 */
interface CartContextValue {
  cart: Cart;
  loading: boolean;
  count: number;
  add: (productId: string, quantity?: number) => Promise<void>;
  update: (productId: string, quantity: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  toggleSaveForLater: (productId: string) => Promise<void>;
  clear: () => Promise<void>;
  totals: (delivery?: DeliveryMethod) => ReturnType<typeof cartService.calculateTotals>;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const empty: Cart = { items: [], updatedAt: new Date().toISOString() };

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(empty);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    cartService.getCart().then(setCart).finally(() => setLoading(false));
  }, []);

  const add = useCallback(async (productId: string, quantity = 1) => {
    setCart(await cartService.addItem(productId, quantity));
    toast.success("Added to cart");
    setDrawerOpen(true);
  }, []);

  const update = useCallback(async (productId: string, quantity: number) => {
    setCart(await cartService.updateQuantity(productId, quantity));
  }, []);

  const remove = useCallback(async (productId: string) => {
    setCart(await cartService.removeItem(productId));
    toast("Removed from cart");
  }, []);

  const toggleSaveForLater = useCallback(async (productId: string) => {
    setCart(await cartService.toggleSaveForLater(productId));
  }, []);

  const clear = useCallback(async () => setCart(await cartService.clear()), []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      count: cart.items.filter((i) => !i.savedForLater).reduce((s, i) => s + i.quantity, 0),
      add,
      update,
      remove,
      toggleSaveForLater,
      clear,
      totals: (delivery: DeliveryMethod = "standard") => cartService.calculateTotals(cart, delivery),
      drawerOpen,
      setDrawerOpen,
    }),
    [cart, loading, add, update, remove, toggleSaveForLater, clear, drawerOpen],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
