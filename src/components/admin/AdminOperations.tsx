import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as admin from "@/server/admin.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Category, Order } from "@/types";
import { currency, formatDate } from "@/utils/format";

function useAdminWrites() {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    async run(action: () => Promise<unknown>) {
      setBusy(true);
      try {
        await action();
        await client.invalidateQueries({
          predicate: (query) => String(query.queryKey[0]).startsWith("admin-"),
        });
        toast.success("Operation completed");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Operation failed");
      } finally {
        setBusy(false);
      }
    },
  };
}
export function AdminOperations({ categories }: { categories: Category[] }) {
  return (
    <Tabs defaultValue="orders">
      <TabsList className="flex h-auto flex-wrap">
        <TabsTrigger value="orders">Orders</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="customers">Customers</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
      </TabsList>
      <TabsContent value="orders">
        <OrdersPanel />
      </TabsContent>
      <TabsContent value="categories">
        <CategoriesPanel categories={categories} />
      </TabsContent>
      <TabsContent value="customers">
        <CustomersPanel />
      </TabsContent>
      <TabsContent value="reviews">
        <ReviewsPanel />
      </TabsContent>
    </Tabs>
  );
}
function OrdersPanel() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["admin-orders", user?.id],
    queryFn: () => admin.getAdminOrders(),
  });
  const writes = useAdminWrites();
  const [filter, setFilter] = useState("");
  const orders = (query.data ?? []).filter((order) => !filter || order.status === filter);
  const transition = (order: Order, status: "shipped" | "delivered" | "cancelled") =>
    writes.run(() =>
      admin.setAdminOrderStatus({
        data: { id: order.id, status, expectedVersion: order.version ?? 0 },
      }),
    );
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-3">
        <Label>
          Status
          <select
            className="ml-2 rounded border p-2"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {["", "pending", "processing", "shipped", "delivered", "cancelled"].map((status) => (
              <option key={status} value={status}>
                {status || "All"}
              </option>
            ))}
          </select>
        </Label>
        <Button
          variant="outline"
          disabled={writes.busy}
          onClick={() => void writes.run(() => admin.runAdminMaintenance())}
        >
          Recover payments / retry email
        </Button>
      </div>
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.isPending && <p>Loading orders…</p>}
      {orders.map((order) => (
        <article key={order.id} className="space-y-3 rounded-xl border border-border p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <h3 className="font-semibold">{order.id}</h3>
            <span>{currency(order.totals.total)}</span>
          </div>
          <p className="text-sm">
            {formatDate(order.createdAt)} · {order.status} · Payment: {order.payment.status} (
            {order.payment.method})
          </p>
          <p className="text-sm text-muted-foreground">
            {order.customerEmail ?? order.userId} · {order.address.fullName},{" "}
            {order.address.address}, {order.address.city}, {order.address.state},{" "}
            {order.address.postalCode} · {order.address.phone}
          </p>
          <ul className="text-sm">
            {order.items.map((item) => (
              <li key={item.productId}>
                {item.name} × {item.quantity} — {currency(item.price)}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {order.status === "processing" && (
              <Button
                size="sm"
                disabled={writes.busy}
                onClick={() => void transition(order, "shipped")}
              >
                Mark shipped
              </Button>
            )}
            {order.status === "shipped" && (
              <Button
                size="sm"
                disabled={writes.busy}
                onClick={() => void transition(order, "delivered")}
              >
                Mark delivered / COD collected
              </Button>
            )}
            {["pending", "processing"].includes(order.status) && (
              <Button
                size="sm"
                variant="outline"
                disabled={writes.busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Cancel this order and restore inventory? Paid test payments will be refunded.",
                    )
                  )
                    void transition(order, "cancelled");
                }}
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={writes.busy}
              onClick={() => void writes.run(() => admin.reconcileAdminOrder({ data: order.id }))}
            >
              Reconcile
            </Button>
          </div>
          {order.providerOrderId && (
            <p className="text-xs text-muted-foreground">
              Provider order: {order.providerOrderId} · payment:{" "}
              {order.providerPaymentId ?? "pending"}
            </p>
          )}
        </article>
      ))}
      {!query.isPending && !orders.length && <p>No matching orders.</p>}
    </div>
  );
}
function CategoriesPanel({ categories }: { categories: Category[] }) {
  const writes = useAdminWrites();
  const [editing, setEditing] = useState<Category | null>(null);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const start = (category?: Category) => {
    setEditing(category ?? null);
    setId(category?.id ?? "");
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setImage(category?.image ?? "");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void writes.run(() =>
      admin.saveAdminCategory({
        data: {
          id,
          name,
          description,
          image,
          archived: editing?.archived ?? false,
          ...(editing ? { expectedVersion: editing.version ?? 0 } : {}),
        },
      }),
    );
  };
  return (
    <div className="mt-6 space-y-4">
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-xl border border-border p-5 sm:grid-cols-2"
      >
        <h3 className="font-semibold sm:col-span-2">
          {editing ? "Edit category" : "New category"}
        </h3>
        <div>
          <Label htmlFor="category-id">Immutable ID / slug</Label>
          <Input
            id="category-id"
            required
            value={id}
            disabled={!!editing}
            onChange={(event) => setId(event.target.value)}
            placeholder="smart-home"
          />
        </div>
        <div>
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="category-image">HTTPS image URL</Label>
          <Input
            id="category-image"
            type="url"
            required
            value={image}
            onChange={(event) => setImage(event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="category-description">Description</Label>
          <Textarea
            id="category-description"
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={writes.busy}>
          Save category
        </Button>
        <Button type="button" variant="outline" onClick={() => start()}>
          New / reset
        </Button>
      </form>
      <ul className="space-y-3">
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
          >
            <span>
              {category.name} · {category.productCount} products ·{" "}
              {category.archived ? "Archived" : "Active"}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => start(category)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={writes.busy}
                onClick={() =>
                  void writes.run(() =>
                    admin.saveAdminCategory({
                      data: {
                        id: category.id,
                        name: category.name,
                        description: category.description,
                        image: category.image,
                        archived: !category.archived,
                        expectedVersion: category.version ?? 0,
                      },
                    }),
                  )
                }
              >
                {category.archived ? "Restore" : "Archive"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
function CustomersPanel() {
  const { user } = useAuth();
  const query = useInfiniteQuery({
    queryKey: ["admin-customers", user?.id],
    initialPageParam: "",
    queryFn: ({ pageParam }) => admin.getAdminCustomers({ data: pageParam }),
    getNextPageParam: (last) => last.nextToken || undefined,
  });
  const writes = useAdminWrites();
  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">
        Disabling a customer is checked against live Cognito state on subsequent requests.
        Administrator accounts cannot be disabled here.
      </p>
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data?.pages
        .flatMap((page) => page.customers)
        .map((customer) => (
          <article
            key={customer.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
          >
            <div>
              <h3 className="font-semibold">{customer.name || customer.email}</h3>
              <p className="text-sm">
                {customer.email} · {customer.disabled ? "Disabled" : "Enabled"}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={writes.busy}
              onClick={() => {
                if (window.confirm(`${customer.disabled ? "Enable" : "Disable"} this customer?`))
                  void writes.run(() =>
                    admin.toggleAdminCustomer({
                      data: { username: customer.username, enabled: !!customer.disabled },
                    }),
                  );
              }}
            >
              {customer.disabled ? "Enable" : "Disable"}
            </Button>
          </article>
        ))}
      {query.hasNextPage && (
        <Button onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
          Load more customers
        </Button>
      )}
    </div>
  );
}
function ReviewsPanel() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["admin-reviews", user?.id],
    queryFn: () => admin.getAdminReviews(),
  });
  const writes = useAdminWrites();
  return (
    <div className="mt-6 space-y-4">
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data?.map((review) => (
        <article key={review.id} className="rounded-xl border border-border p-5">
          <h3 className="font-semibold">
            {review.title} · {review.rating} stars
          </h3>
          <p className="mt-2 text-sm">{review.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {review.author} · {review.productId} · {review.status}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              disabled={writes.busy}
              onClick={() =>
                void writes.run(() =>
                  admin.setAdminReview({ data: { id: review.id, status: "approved" } }),
                )
              }
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={writes.busy}
              onClick={() =>
                void writes.run(() =>
                  admin.setAdminReview({ data: { id: review.id, status: "rejected" } }),
                )
              }
            >
              Reject / hide
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
