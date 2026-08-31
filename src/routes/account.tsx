import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/states";
import { AwsIntegrationPlaceholder } from "@/components/aws/AwsIntegrationPlaceholder";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";
import { orderService } from "@/services";
import { products } from "@/data/products";
import type { Order } from "@/types";
import { currency, formatDate } from "@/utils/format";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your account — IntelliMart" },
      { name: "description", content: "Manage your IntelliMart profile, review past orders and revisit your wishlist." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your account — IntelliMart" },
      { property: "og:description", content: "Profile, orders and wishlist in one place." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const { items: wishlist, remove } = useWishlist();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (user) orderService.list(user.id).then(setOrders);
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="You're signed out"
          description="Sign in to view your profile, orders and wishlist."
          action={<Button asChild variant="hero"><Link to="/login">Sign in</Link></Button>}
        />
      </div>
    );
  }

  const wishlistProducts = wishlist
    .map((w) => products.find((p) => p.id === w.productId))
    .filter((p): p is (typeof products)[number] => Boolean(p));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Hi, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" onClick={() => void signOut()}>Sign out</Button>
      </div>

      <Tabs defaultValue="orders" className="mt-10">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" id="orders" className="mt-6 space-y-4">
          {orders.length === 0 ? (
            <EmptyState title="No orders yet" description="Your completed orders will appear here." action={<Button asChild><Link to="/shop">Start shopping</Link></Button>} />
          ) : (
            orders.map((o) => (
              <article key={o.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{o.id}</h2>
                    <p className="text-xs text-muted-foreground">Placed {formatDate(o.createdAt)} · {o.status}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{currency(o.totals.total)}</span>
                </div>
                <ul className="mt-4 flex flex-wrap gap-3">
                  {o.items.map((i) => (
                    <li key={i.productId} className="flex items-center gap-2 rounded-xl border border-border p-2">
                      <img src={i.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <span className="text-xs">{i.name} × {i.quantity}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </TabsContent>

        <TabsContent value="wishlist" className="mt-6">
          {wishlistProducts.length === 0 ? (
            <EmptyState title="Your wishlist is empty" description="Tap the heart on any product to save it." action={<Button asChild><Link to="/shop">Browse products</Link></Button>} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {wishlistProducts.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <img src={p.images[0]} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  <div className="flex-1">
                    <Link to="/product/$id" params={{ id: p.id }} className="text-sm font-semibold hover:underline">{p.name}</Link>
                    <p className="text-sm text-muted-foreground tabular-nums">{currency(p.price)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(p.id)}>Remove</Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-6 space-y-6">
          <dl className="grid gap-5 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</dt><dd className="mt-1 text-sm">{user.name}</dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</dt><dd className="mt-1 text-sm">{user.email}</dd></div>
          </dl>
          <AwsIntegrationPlaceholder
            service="Amazon Cognito"
            objective="Replace the mock session with Cognito user pools, hosted UI and JWT-backed profile reads."
            location="src/services/auth/mockAuthService.ts"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
