import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/common/states";
import { CartItemRow } from "./CartItemRow";
import { useCart } from "@/hooks/useCart";
import { currency } from "@/utils/format";

export function CartDrawer() {
  const { cart, drawerOpen, setDrawerOpen, totals, count } = useCart();
  const active = cart.items.filter((i) => !i.savedForLater);
  const t = totals();

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl font-medium">Your bag ({count})</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {active.length === 0 ? (
            <EmptyState
              title="Your cart is empty"
              description="Browse the catalogue and add something you like."
              icon={<ShoppingBag className="h-5 w-5" aria-hidden />}
              action={
                <Button asChild onClick={() => setDrawerOpen(false)}>
                  <Link to="/shop">Start shopping</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-5">
              {active.map((item) => (
                <CartItemRow key={item.productId} item={item} compact />
              ))}
            </div>
          )}
        </div>

        {active.length > 0 && (
          <SheetFooter className="bg-surface p-6">
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold tabular-nums">{currency(t.subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Shipping and taxes are calculated at checkout.
              </p>
              <div className="grid gap-2">
                <Button asChild variant="hero" onClick={() => setDrawerOpen(false)}>
                  <Link to="/checkout">Checkout</Link>
                </Button>
                <Button asChild variant="outline" onClick={() => setDrawerOpen(false)}>
                  <Link to="/cart">View cart</Link>
                </Button>
              </div>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
