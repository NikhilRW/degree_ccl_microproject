import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/common/states";
import { orderService } from "@/services";
import type { Order } from "@/types";
import { currency, formatDate } from "@/utils/format";

export const Route = createFileRoute("/order-confirmation")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? search["id"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Order confirmed — IntelliMart" },
      {
        name: "description",
        content:
          "Your IntelliMart order is confirmed. Track the order ID, items and estimated delivery.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Order confirmed — IntelliMart" },
      { property: "og:description", content: "Order details and estimated delivery." },
    ],
  }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  const { id } = Route.useSearch();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderService.getById(id).then(setOrder).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState label="Fetching your order" />;
  if (!order)
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="Order not found"
          description="We couldn't find that order."
          action={
            <Button asChild>
              <Link to="/shop">Continue shopping</Link>
            </Button>
          }
        />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="animate-rise text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
        <h1 className="mt-5 font-display text-3xl font-semibold sm:text-4xl">
          {order.status === "pending"
            ? "Order pending payment"
            : order.status === "cancelled"
              ? "Order cancelled"
              : "Order received"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Thanks {order.address.fullName.split(" ")[0]} — we've sent a confirmation to your inbox.
        </p>
      </div>

      <div className="mt-10 rounded-2xl border border-border bg-card p-6">
        <dl className="grid gap-5 sm:grid-cols-3">
          {[
            ["Order ID", order.id],
            ["Order date", formatDate(order.createdAt)],
            ["Estimated delivery", formatDate(order.estimatedDelivery)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {k}
              </dt>
              <dd className="mt-1 text-sm font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-6 divide-y divide-border border-t border-border">
          {order.items.map((i) => (
            <li key={i.productId} className="flex items-center gap-3 py-3">
              <img src={i.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <span className="flex-1 text-sm">
                {i.name} × {i.quantity}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {currency(i.price * i.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-semibold">
          <span>Order total</span>
          <span className="tabular-nums">{currency(order.totals.total)}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Payment: {order.payment.method === "cod" ? "Cash on delivery" : "Mock-approved — no money charged"}
        </p>

        <div className="mt-6 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shipping address
          </h2>
          <p className="mt-1 text-muted-foreground">
            {order.address.fullName}, {order.address.address}, {order.address.city},{" "}
            {order.address.state} {order.address.postalCode}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="hero">
          <Link to="/account" hash="orders">
            View order
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/shop">Continue shopping</Link>
        </Button>
      </div>
    </div>
  );
}
