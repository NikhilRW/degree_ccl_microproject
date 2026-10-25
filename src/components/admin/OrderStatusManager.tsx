import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState } from "@/components/common/states";
import { adminOrderStatusSchema, orderStatuses, orderStatusSchema } from "@/domain/contracts";
import { adminService } from "@/services/admin";
import { authGeneration, isCurrentAuthGeneration, ServiceError } from "@/services/rpc";
import type { AdminOrderSummary, OrderStatus } from "@/types";
import { currency, formatDate } from "@/utils/format";

type Cursor = { ownerId: string; orderId: string };
const orderKey = (order: AdminOrderSummary) => `${order.ownerId}:${order.id}`;
const statusLabel = (status: OrderStatus) => status[0]!.toUpperCase() + status.slice(1);
function uniqueOrders(orders: AdminOrderSummary[]) {
  return [...new Map(orders.map(order => [orderKey(order), order])).values()];
}

export function OrderStatusManager() {
  const [orders, setOrders] = useState<AdminOrderSummary[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const active = useRef(true);
  const request = useRef(0);

  const reload = useCallback(async (pageCount: number) => {
    const generation = authGeneration();
    const sequence = ++request.current;
    const current = () => active.current && sequence === request.current && isCurrentAuthGeneration(generation);
    setLoading(true); setError("");
    try {
      let next: Cursor | null = null;
      const refreshed: AdminOrderSummary[] = [];
      let fetched = 0;
      do {
        const page = await adminService.listOrders(next ? { cursor: next } : {});
        if (!current()) return false;
        refreshed.push(...page.orders); next = page.nextCursor; fetched++;
      } while (next && fetched < pageCount);
      if (current()) {
        setOrders(uniqueOrders(refreshed)); setCursor(next); setPages(fetched); setLoaded(true);
      }
      return true;
    } catch (error) {
      if (current()) setError(error instanceof Error ? error.message : "Could not load orders.");
      return false;
    } finally { if (current()) setLoading(false); }
  }, []);

  useEffect(() => {
    active.current = true;
    void reload(1);
    return () => { active.current = false; request.current++; };
  }, [reload]);

  const loadMore = async () => {
    if (!cursor || loading || updating) return;
    const generation = authGeneration();
    const sequence = ++request.current;
    const current = () => active.current && sequence === request.current && isCurrentAuthGeneration(generation);
    setLoading(true); setError("");
    try {
      const page = await adminService.listOrders({ cursor });
      if (current()) {
        setOrders(previous => uniqueOrders([...previous, ...page.orders]));
        setCursor(page.nextCursor); setPages(previous => previous + 1);
      }
    } catch (error) {
      if (current()) setError(error instanceof Error ? error.message : "Could not load more orders.");
    } finally { if (current()) setLoading(false); }
  };

  const update = async (order: AdminOrderSummary, status: OrderStatus) => {
    if (loading || updating) return;
    const generation = authGeneration();
    const current = () => active.current && isCurrentAuthGeneration(generation);
    const data = adminOrderStatusSchema.parse({ ownerId: order.ownerId, orderId: order.id, expectedStatus: order.status, status });
    setUpdating(orderKey(order)); setError(""); setSuccess("");
    try {
      const saved = await adminService.updateOrderStatus(data);
      if (!current()) return;
      setOrders(previous => previous.map(item => orderKey(item) === orderKey(saved) ? saved : item));
      setSuccess(`${saved.id} is now ${saved.status}.`);
      // Reload every visible page, not just the first one. Base-table reads in
      // the list RPC show the actual saved status despite GSI propagation lag.
      const refreshed = await reload(pages);
      if (current() && !refreshed) setError("The status was saved, but the order list could not be refreshed. Use Refresh orders to load the latest data.");
    } catch (error) {
      if (!current()) return;
      const message = error instanceof Error ? error.message : "Could not update the order status.";
      if (error instanceof ServiceError && error.status === 409) await reload(pages);
      if (current()) setError(message);
    } finally { if (current()) setUpdating(null); }
  };

  const busy = loading || updating !== null;
  return <section className="mt-8" aria-labelledby="admin-orders" aria-busy={busy}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="admin-orders" className="text-lg font-semibold">Orders</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Change processing, shipped, delivered or cancelled status. Mark delivered only after receipt is confirmed. Payment status is not changed.</p>
      </div>
      <Button variant="outline" disabled={busy} onClick={() => { setSuccess(""); void reload(pages); }}>{loading && loaded ? "Refreshing…" : "Refresh orders"}</Button>
    </div>
    {success && <p role="status" className="mt-4 text-sm">{success}</p>}
    {error && <div className="mt-4 bg-surface p-4"><p role="alert" className="text-sm text-destructive">{error}</p>
      {!loaded && <Button className="mt-3" variant="outline" disabled={busy} onClick={() => void reload(1)}>Try again</Button>}
    </div>}
    {!loaded && loading ? <LoadingState label="Loading orders" /> : loaded && <>
      <p role="status" className="mt-5 text-sm text-muted-foreground">Showing {orders.length} order{orders.length === 1 ? "" : "s"}{cursor ? " · More orders available" : " · All orders loaded"}. Newly placed orders may take a moment to appear in the index.</p>
      {!orders.length && <p className="mt-4 bg-surface p-6 text-sm">No orders yet.</p>}
      <div className="mt-4 space-y-4">{orders.map(order => <OrderStatusRow key={`${orderKey(order)}:${order.status}`} order={order}
        disabled={busy} saving={updating === orderKey(order)} onSave={status => void update(order, status)} />)}</div>
      {cursor && <div className="mt-5"><Button variant="outline" disabled={busy} onClick={() => void loadMore()}>{loading ? "Loading…" : "Load more orders"}</Button></div>}
    </>}
  </section>;
}

function OrderStatusRow({ order, disabled, saving, onSave }: {
  order: AdminOrderSummary; disabled: boolean; saving: boolean; onSave: (status: OrderStatus) => void;
}) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const controlId = `order-status-${order.ownerId}-${order.id}`;
  return <article className="bg-surface p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="break-all text-sm font-semibold">{order.id}</h3>
        <p className="mt-2 text-sm">{order.customerName} · {formatDate(order.createdAt)}</p>
      </div>
      <div className="text-right"><p className="text-base font-medium tabular-nums">{currency(order.total)}</p><p className="mt-1 text-sm text-muted-foreground">{statusLabel(order.status)}</p></div>
    </div>
    <ul className="mt-4 space-y-2 text-sm">{order.items.map((item, index) => <li key={`${item.productId}:${index}`} className="flex justify-between gap-4">
      <span>{item.quantity} × {item.name}</span><span className="shrink-0 text-right tabular-nums">{currency(item.price)} each</span>
    </li>)}</ul>
    <form className="mt-5 flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); onSave(status); }}>
      <div className="w-full space-y-2 sm:w-56"><Label htmlFor={controlId}>Order status</Label>
        <Select value={status} disabled={disabled} onValueChange={value => setStatus(orderStatusSchema.parse(value))}>
          <SelectTrigger id={controlId}><SelectValue /></SelectTrigger><SelectContent>{orderStatuses.map(value => <SelectItem key={value} value={value}>{statusLabel(value)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" disabled={disabled || status === order.status}>{saving ? "Saving…" : "Save status"}</Button>
    </form>
    {status !== order.status && <p className="mt-3 text-sm text-muted-foreground">
      {status === "cancelled" ? "Cancelling restores all ordered quantities to stock once." : order.status === "cancelled" ?
        "Reopening reserves the ordered quantities again. The change is refused if any product has insufficient stock." :
        "Only order status changes; stock, historical prices and payment status stay the same."}
    </p>}
  </article>;
}
