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
import { cartService } from "@/services";
import { useAuth } from "./useAuth";
import type { Cart, DeliveryMethod } from "@/types";

interface CartContextValue {
  cart: Cart;
  loading: boolean;
  count: number;
  add: (id: string, quantity?: number) => Promise<void>;
  update: (id: string, quantity: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggleSaveForLater: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
  totals: (delivery?: DeliveryMethod) => ReturnType<typeof cartService.calculateTotals>;
  drawerOpen: boolean;
  setDrawerOpen: (value: boolean) => void;
}
const CartContext = createContext<CartContextValue | null>(null);
const emptyCart = (): Cart => ({ items: [], updatedAt: new Date().toISOString() });
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const identity = useRef<string | null>(null);
  identity.current = user?.id ?? null;
  const apply = useCallback(async (work: () => Promise<Cart>) => {
    const owner = identity.current;
    const result = await work();
    if (identity.current === owner) setCart(result);
  }, []);
  const refresh = useCallback(() => apply(() => cartService.getCart()), [apply]);
  useEffect(() => {
    if (authLoading) return;
    let current = true;
    setCart(emptyCart());
    setLoading(true);
    cartService
      .getCart()
      .then((value) => {
        if (current) setCart(value);
      })
      .catch(() => toast.error("Could not load your cart"))
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [user?.id, authLoading]);
  const add = useCallback(
    async (id: string, quantity = 1) => {
      try {
        await apply(() => cartService.addItem(id, quantity));
        toast.success("Added to cart");
        setDrawerOpen(true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add item");
      }
    },
    [apply],
  );
  const update = useCallback(
    async (id: string, quantity: number) => {
      try {
        await apply(() => cartService.updateQuantity(id, quantity));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not update cart");
      }
    },
    [apply],
  );
  const remove = useCallback(
    async (id: string) => {
      await apply(() => cartService.removeItem(id));
      toast("Removed from cart");
    },
    [apply],
  );
  const toggleSaveForLater = useCallback(
    (id: string) => apply(() => cartService.toggleSaveForLater(id)),
    [apply],
  );
  const clear = useCallback(() => apply(() => cartService.clear()), [apply]);
  const value = useMemo(
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
      totals: (delivery: DeliveryMethod = "standard") =>
        cartService.calculateTotals(cart, delivery),
      drawerOpen,
      setDrawerOpen,
    }),
    [cart, loading, add, update, remove, toggleSaveForLater, clear, refresh, drawerOpen],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
