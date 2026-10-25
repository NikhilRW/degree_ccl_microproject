import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";
import { orderService, productService } from "@/services";
import type { Order, Product } from "@/types";
import { currency, formatDate } from "@/utils/format";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your account — IntelliMart" },
      {
        name: "description",
        content: "Manage your IntelliMart profile, review past orders and revisit your wishlist.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Your account — IntelliMart" },
      { property: "og:description", content: "Profile, orders and wishlist in one place." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { hash } = useLocation();
  const [tab, setTab] = useState(hash === "wishlist" ? "wishlist" : "orders");
  const { user, loading: authLoading, signOut } = useAuth();
  const { items: wishlist, remove } = useWishlist();
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  useEffect(() => {
    setTab(hash === "wishlist" ? "wishlist" : "orders");
  }, [hash]);

  useEffect(() => {
    let cancelled = false;
    setOrders([]);
    setOrdersError(null);
    if (!user) return;
    setOrdersLoading(true);
    orderService
      .list()
      .then((value) => {
        if (!cancelled) setOrders(value);
      })
      .catch((error) => {
        if (!cancelled)
          setOrdersError(error instanceof Error ? error.message : "Could not load your orders.");
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    setWishlistProducts([]);
    setWishlistError(null);
    setWishlistLoading(false);
    if (!user || !wishlist.length) return;
    setWishlistLoading(true);
    Promise.all(wishlist.map((item) => productService.getById(item.productId)))
      .then((items) => {
        if (!cancelled) setWishlistProducts(items.filter((item): item is Product => item !== null));
      })
      .catch((error) => {
        if (!cancelled)
          setWishlistError(
            error instanceof Error ? error.message : "Could not load your wishlist.",
          );
      })
      .finally(() => {
        if (!cancelled) setWishlistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wishlist, user?.id, user]);

  if (authLoading) return <LoadingState label="Loading your account" />;
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="You're signed out"
          description="Sign in to view your profile, orders and wishlist."
          action={
            <Button asChild variant="hero">
              <Link to="/login">Sign in</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="site-container pb-24 pt-10 sm:pt-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-medium sm:text-6xl">
            Hi, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-10">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" id="orders" className="mt-6 space-y-4">
          {ordersLoading ? (
            <LoadingState label="Loading orders" />
          ) : ordersError ? (
            <ErrorState message={ordersError} />
          ) : orders.length === 0 ? (
            <EmptyState
              title="No orders yet"
              description="Your completed orders will appear here."
              action={
                <Button asChild>
                  <Link to="/shop">Start shopping</Link>
                </Button>
              }
            />
          ) : (
            orders.map((o) => (
              <article key={o.id} className="bg-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{o.id}</h2>
                    <p className="text-xs text-muted-foreground">
                      Placed {formatDate(o.createdAt)} · {o.status}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {currency(o.totals.total)}
                  </span>
                </div>
                <ul className="mt-4 flex flex-wrap gap-3">
                  {o.items.map((i) => (
                    <li
                      key={i.productId}
                      className="flex items-center gap-2 rounded-xl border border-border p-2"
                    >
                      <img src={i.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      <span className="text-xs">
                        {i.name} × {i.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-3">
                  {["pending", "processing"].includes(o.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm(`Cancel ${o.id}?`))
                          void orderService.cancel(o.id).then(
                            (value) =>
                              setOrders((current) =>
                                current.map((item) => (item.id === value.id ? value : item)),
                              ),
                            (error: Error) => toast.error(error.message),
                          );
                      }}
                    >
                      Cancel order
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">Payment: {o.payment.method === "cod" ? "Cash on delivery" : o.payment.status === "mocked" ? "Mock-approved · no money charged" : o.payment.status}</p>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/order-confirmation" search={{ id: o.id }}>
                      Order details
                    </Link>
                  </Button>
                </div>
              </article>
            ))
          )}
        </TabsContent>

        <TabsContent value="wishlist" className="mt-6">
          {wishlistLoading ? (
            <LoadingState label="Loading wishlist" />
          ) : wishlistError ? (
            <ErrorState message={wishlistError} />
          ) : wishlistProducts.length === 0 ? (
            <EmptyState
              title="Your wishlist is empty"
              description="Tap the heart on any product to save it."
              action={
                <Button asChild>
                  <Link to="/shop">Browse products</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {wishlistProducts.map((p) => (
                <li key={p.id} className="flex items-center gap-4 bg-surface p-5">
                  <img src={p.images[0]} alt="" className="h-16 w-16 rounded-xl object-cover" />
                  <div className="flex-1">
                    <Link
                      to="/product/$id"
                      params={{ id: p.id }}
                      className="text-sm font-semibold hover:underline"
                    >
                      {p.name}
                    </Link>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {currency(p.price)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(p.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-6 space-y-6">
          <dl className="grid gap-5 bg-surface p-6 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="mt-2 text-base">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="mt-2 text-base">{user.email}</dd>
            </div>
          </dl>
        </TabsContent>
      </Tabs>
    </div>
  );
}
