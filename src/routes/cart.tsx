import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { EmptyState, LoadingState } from "@/components/common/states";
import { AwsIntegrationPlaceholder } from "@/components/aws/AwsIntegrationPlaceholder";
import { useCart } from "@/hooks/useCart";
import { currency } from "@/utils/format";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — IntelliMart" },
      { name: "description", content: "Review the items in your IntelliMart cart, update quantities and continue to checkout." },
      { property: "og:title", content: "Your cart — IntelliMart" },
      { property: "og:description", content: "Review items, update quantities and continue to checkout." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { cart, loading, totals } = useCart();
  const active = cart.items.filter((i) => !i.savedForLater);
  const saved = cart.items.filter((i) => i.savedForLater);
  const t = totals();

  if (loading) return <LoadingState label="Loading your cart" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Your cart</h1>

      {active.length === 0 && saved.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<ShoppingBag className="h-5 w-5" aria-hidden />}
            title="Your cart is empty"
            description="Once you add products they'll show up here."
            action={
              <Button asChild>
                <Link to="/shop">Continue shopping</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="divide-y divide-border rounded-2xl border border-border bg-card px-5">
              {active.map((i) => (
                <CartItemRow key={i.productId} item={i} />
              ))}
              {active.length === 0 && <p className="py-8 text-sm text-muted-foreground">No active items.</p>}
            </div>

            {saved.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-lg font-semibold">Saved for later</h2>
                <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card px-5">
                  {saved.map((i) => (
                    <CartItemRow key={i.productId} item={i} />
                  ))}
                </div>
              </section>
            )}

            <AwsIntegrationPlaceholder
              className="mt-8"
              service="Amazon DynamoDB (Cart table)"
              objective="Persist the cart per authenticated user instead of localStorage."
              location="src/services/cart/mockCartService.ts"
            />
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg font-semibold">Order summary</h2>
              <dl className="mt-5 space-y-3 text-sm">
                {[
                  ["Subtotal", currency(t.subtotal)],
                  ["Discount applied", `−${currency(t.discount)}`],
                  ["Shipping", t.shipping === 0 ? "Free" : currency(t.shipping)],
                  ["Tax (18%)", currency(t.tax)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="tabular-nums">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{currency(t.total)}</dd>
                </div>
              </dl>
              <div className="mt-6 grid gap-2">
                <Button asChild variant="hero" size="lg" disabled={active.length === 0}>
                  <Link to="/checkout">Proceed to checkout</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/shop">Continue shopping</Link>
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
