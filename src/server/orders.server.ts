import { createHash, randomUUID } from "node:crypto";
import type { Order, Product, User, Cart, Category } from "@/types";
import type { z } from "zod";
import type { checkoutSchema } from "./validation";
import { calculateTotals, toPaise, validateQuantity } from "./pricing";
import { change, getRecords, retryConflict, auditChange, type Change } from "./records.server";
import { getRuntimeConfig } from "./runtime.server";
import {
  razorpay,
  getPaymentSecrets,
  type ProviderPayment,
  type ProviderOrder,
  type ProviderRefund,
} from "./razorpay.server";
import { verifyHmac } from "./payment-security";
import { queueOrderEmail } from "./notifications.server";
import type { StoredCartItem } from "./shopping.server";

export async function listCustomerOrders(userId: string) {
  // Bounded lab access pattern. No browser-supplied owner is used by public handlers.
  return (await getRecords().list<Order>("ORDER"))
    .filter((row) => row.value.userId === userId)
    .map((row) => row.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function ownedOrder(id: string, user: User) {
  const row = await getRecords().get<Order>("ORDER", id);
  if (!row || (row.value.userId !== user.id && !user.isAdmin)) throw new Error("Order not found.");
  return row;
}
export async function beginCheckout(input: z.infer<typeof checkoutSchema>, user: User) {
  const records = getRecords();
  const config = getRuntimeConfig();
  const idempotencyId = `${user.id}#${input.idempotencyKey}`;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({ address: input.address, delivery: input.delivery, method: input.method }),
    )
    .digest("hex");
  let order: Order;
  const existing = await records.get<{ orderId: string; fingerprint?: string }>(
    "CHECKOUT_KEY",
    idempotencyId,
  );
  if (existing) {
    if (existing.value.fingerprint && existing.value.fingerprint !== fingerprint)
      throw new Error(
        "This pending checkout uses different shipping/payment details. Cancel it in your account and start a new checkout.",
      );
    const row = await ownedOrder(existing.value.orderId, user);
    if (row.value.status === "cancelled")
      throw new Error("This checkout was cancelled. Start a new checkout from your cart.");
    order = row.value;
  } else {
    const cartRow = await records.get<StoredCartItem[]>("CART", user.id);
    const active = (cartRow?.value ?? []).filter((item) => !item.savedForLater);
    if (!active.length || active.length > 20)
      throw new Error("Add between 1 and 20 products to your cart.");
    const productRows = await Promise.all(
      active.map((item) => records.get<Product>("PRODUCT", item.productId)),
    );
    const categories = await records.list<Category>("CATEGORY");
    const cart: Cart = { items: [], updatedAt: new Date().toISOString() };
    const inventory: Change[] = [];
    active.forEach((item, index) => {
      const row = productRows[index];
      if (!row) throw new Error("A product is no longer available.");
      if (
        !categories.some(
          (category) => category.id === row.value.categoryId && !category.value.archived,
        )
      )
        throw new Error("A product category is unavailable.");
      validateQuantity(row.value, item.quantity);
      cart.items.push({ ...item, product: row.value });
      inventory.push(
        change("PRODUCT", row.id, row, {
          ...row.value,
          stock: row.value.stock - item.quantity,
          version: (row.value.version ?? 0) + 1,
        }),
      );
    });
    const totals = calculateTotals(cart, input.delivery);
    if (totals.total <= 0) throw new Error("Checkout amount must be positive.");
    const now = new Date();
    const id = `IM-${now.getFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    order = {
      id,
      userId: user.id,
      items: cart.items.map((item) => ({
        productId: item.productId,
        name: item.product.name,
        image: item.product.images[0] ?? "",
        price: item.product.price,
        quantity: item.quantity,
      })),
      totals,
      address: input.address,
      delivery: input.delivery,
      payment: { id: `pay_${id}`, method: input.method, status: "pending", amount: totals.total },
      status: input.method === "cod" ? "processing" : "pending",
      createdAt: now.toISOString(),
      estimatedDelivery: new Date(
        now.getTime() + (input.delivery === "express" ? 2 : 6) * 86400000,
      ).toISOString(),
      version: 1,
      reservationExpiresAt:
        input.method === "cod" ? 0 : Date.now() + config.reservationMinutes * 60000,
      inventoryReleased: false,
      customerEmail: user.email,
    };
    try {
      await records.transaction([
        ...inventory,
        change("ORDER", id, null, order),
        change("CHECKOUT_KEY", idempotencyId, null, { orderId: id, fingerprint }),
        ...(cartRow
          ? [
              change(
                "CART",
                user.id,
                cartRow,
                input.method === "cod"
                  ? cartRow.value.filter((item) => item.savedForLater)
                  : cartRow.value,
              ),
            ]
          : []),
      ]);
    } catch (error) {
      const duplicate = await records.get<{ orderId: string }>("CHECKOUT_KEY", idempotencyId);
      if (!duplicate) throw error;
      return beginCheckout(input, user);
    }
    if (input.method === "cod") await queueOrderEmail(order, "confirmation");
    else if (config.mode === "cloud") {
      try {
        const provider = await razorpay<ProviderOrder>("/orders", "POST", {
          amount: toPaise(totals.total),
          currency: "INR",
          receipt: id,
          notes: { intellimartOrderId: id },
        });
        if (
          !/^order_[A-Za-z0-9]+$/.test(provider.id) ||
          provider.amount !== toPaise(totals.total) ||
          provider.currency !== "INR"
        )
          throw new Error("Invalid provider order response.");
        const row = await records.get<Order>("ORDER", id);
        if (!row || row.value.status !== "pending")
          throw new Error("Checkout is no longer pending.");
        order = {
          ...row.value,
          providerOrderId: provider.id,
          version: (row.value.version ?? 0) + 1,
        };
        await records.transaction([
          change("ORDER", id, row, order),
          change("PROVIDER_ORDER", provider.id, null, { orderId: id }),
        ]);
      } catch (error) {
        await releaseAndCancel(id, "checkout.provider_failed");
        throw error;
      }
    }
  }
  if (
    order.payment.method !== "cod" &&
    config.mode === "cloud" &&
    !order.providerOrderId &&
    order.payment.status !== "captured"
  )
    throw new Error(
      "Checkout preparation is incomplete. Wait and retry; expired reservations will be recovered automatically.",
    );
  return {
    order,
    demo: config.mode === "demo",
    keyId:
      config.mode === "cloud" && order.payment.method !== "cod"
        ? (await getPaymentSecrets()).keyId
        : "",
    amount: toPaise(order.totals.total),
    currency: "INR" as const,
  };
}

export async function finalizePayment(
  orderId: string,
  paymentId: string,
  simulated = false,
): Promise<Order> {
  const records = getRecords();
  const initial = await records.get<Order>("ORDER", orderId);
  if (!initial) throw new Error("Order not found.");
  if (simulated && getRuntimeConfig().mode !== "demo")
    throw new Error("Simulated payments are forbidden in cloud mode.");
  let provider: ProviderPayment | undefined;
  if (!simulated) {
    provider = await razorpay<ProviderPayment>(`/payments/${encodeURIComponent(paymentId)}`);
    if (
      provider.id !== paymentId ||
      provider.order_id !== initial.value.providerOrderId ||
      provider.amount !== toPaise(initial.value.totals.total) ||
      provider.currency !== "INR" ||
      provider.status !== "captured"
    )
      throw new Error(
        "Payment has not been captured for the correct order, payment reference, amount and currency. Check order history and retry verification after capture.",
      );
  }
  const result = await retryConflict(async () => {
    const row = await records.get<Order>("ORDER", orderId);
    if (!row) throw new Error("Order not found.");
    if (row.value.payment.status === "captured") {
      if (row.value.providerPaymentId && row.value.providerPaymentId !== paymentId)
        throw new Error("This order already has a different payment.");
      return row.value;
    }
    if (["refund_pending", "refunded"].includes(row.value.payment.status)) return row.value;
    if (row.value.status === "cancelled") {
      const value: Order = {
        ...row.value,
        providerPaymentId: paymentId,
        payment: { ...row.value.payment, id: paymentId, status: "refund_pending" },
        version: (row.value.version ?? 0) + 1,
      };
      await records.transaction([change("ORDER", orderId, row, value)]);
      return value;
    }
    const cart = await records.get<StoredCartItem[]>("CART", row.value.userId);
    const remaining = (cart?.value ?? []).flatMap((item) => {
      if (item.savedForLater) return [item];
      const purchased =
        row.value.items.find((line) => line.productId === item.productId)?.quantity ?? 0;
      return item.quantity > purchased ? [{ ...item, quantity: item.quantity - purchased }] : [];
    });
    const value: Order = {
      ...row.value,
      status: "processing",
      reservationExpiresAt: 0,
      providerPaymentId: paymentId,
      payment: { ...row.value.payment, id: paymentId, status: "captured" },
      version: (row.value.version ?? 0) + 1,
    };
    await records.transaction([
      change("ORDER", orderId, row, value),
      ...(cart ? [change("CART", row.value.userId, cart, remaining)] : []),
    ]);
    return value;
  });
  if (result.payment.status === "refund_pending") await refundOrder(result.id);
  else if (result.payment.status === "captured") await queueOrderEmail(result, "confirmation");
  return (await records.get<Order>("ORDER", orderId))!.value;
}
export async function verifyCheckout(
  orderId: string,
  paymentId: string,
  signature: string,
  user: User,
) {
  const row = await ownedOrder(orderId, user);
  if (getRuntimeConfig().mode === "demo") return finalizePayment(row.id, `demo_${row.id}`, true);
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId) || !row.value.providerOrderId)
    throw new Error("Invalid payment reference.");
  const keys = await getPaymentSecrets();
  if (!verifyHmac(`${row.value.providerOrderId}|${paymentId}`, signature, keys.keySecret))
    throw new Error("Payment signature verification failed.");
  return finalizePayment(row.id, paymentId);
}

export async function resumeCheckout(orderId: string, user: User) {
  const row = await ownedOrder(orderId, user);
  if (row.value.userId !== user.id) throw new Error("Only the customer can resume this checkout.");
  if (row.value.status === "pending" && (row.value.reservationExpiresAt ?? 0) < Date.now())
    await reconcileOrder(orderId);
  const current = (await ownedOrder(orderId, user)).value;
  if (current.status === "cancelled")
    throw new Error(
      "This checkout has expired or was cancelled. Start a new checkout from your cart.",
    );
  const config = getRuntimeConfig();
  if (current.status === "pending" && config.mode === "cloud" && !current.providerOrderId)
    throw new Error(
      "Payment preparation did not complete. Cancel this pending order and start a new checkout.",
    );
  return {
    order: current,
    demo: config.mode === "demo",
    keyId:
      current.status === "pending" && config.mode === "cloud"
        ? (await getPaymentSecrets()).keyId
        : "",
    amount: toPaise(current.totals.total),
    currency: "INR" as const,
  };
}

export async function releaseAndCancel(orderId: string, actor: string): Promise<Order> {
  return retryConflict(async () => {
    const row = await getRecords().get<Order>("ORDER", orderId);
    if (!row) throw new Error("Order not found.");
    if (["shipped", "delivered"].includes(row.value.status))
      throw new Error("A shipped or delivered order cannot be cancelled.");
    if (row.value.status === "cancelled" && row.value.inventoryReleased) return row.value;
    const inventory: Change[] = [];
    if (!row.value.inventoryReleased)
      for (const item of row.value.items) {
        const product = await getRecords().get<Product>("PRODUCT", item.productId);
        if (!product)
          throw new Error("Cannot restore inventory for a missing product; reconcile manually.");
        inventory.push(
          change("PRODUCT", product.id, product, {
            ...product.value,
            stock: product.value.stock + item.quantity,
            version: (product.value.version ?? 0) + 1,
          }),
        );
      }
    const value: Order = {
      ...row.value,
      status: "cancelled",
      inventoryReleased: true,
      reservationExpiresAt: 0,
      payment: {
        ...row.value.payment,
        status:
          row.value.payment.status === "captured"
            ? "refund_pending"
            : row.value.payment.status === "pending"
              ? "failed"
              : row.value.payment.status,
      },
      version: (row.value.version ?? 0) + 1,
    };
    await getRecords().transaction([
      ...inventory,
      change("ORDER", orderId, row, value),
      auditChange(actor, "order.cancelled", orderId),
    ]);
    return value;
  });
}
export async function cancelOrder(orderId: string, user: User) {
  const row = await ownedOrder(orderId, user);
  const result = await releaseAndCancel(row.id, user.id);
  if (result.payment.status === "refund_pending") {
    try {
      await refundOrder(result.id);
    } catch {
      console.warn(JSON.stringify({ event: "refund.retry_pending", orderId }));
    }
  }
  return (await getRecords().get<Order>("ORDER", orderId))!.value;
}
export async function refundOrder(orderId: string) {
  const records = getRecords();
  const lease = await retryConflict(async () => {
    const row = await records.get<{ until: number }>("REFUND_LOCK", orderId);
    if (row && row.value.until > Date.now()) return false;
    await records.transaction([
      change("REFUND_LOCK", orderId, row, { until: Date.now() + 120000 }),
    ]);
    return true;
  });
  if (!lease) return;
  const row = await records.get<Order>("ORDER", orderId);
  if (!row || row.value.payment.status !== "refund_pending") return;
  if (getRuntimeConfig().mode === "cloud") {
    if (!row.value.providerPaymentId) throw new Error("Missing payment reference for refund.");
    const paymentId = encodeURIComponent(row.value.providerPaymentId);
    const refunds = await razorpay<{ items: ProviderRefund[] }>(`/payments/${paymentId}/refunds`);
    let refund = refunds.items.find(
      (item) =>
        item.receipt === orderId &&
        item.amount === toPaise(row.value.totals.total) &&
        item.status !== "failed",
    );
    if (!refund)
      refund = await razorpay<ProviderRefund>(`/payments/${paymentId}/refund`, "POST", {
        amount: toPaise(row.value.totals.total),
        receipt: orderId,
        notes: { intellimartOrderId: orderId },
      });
    if (refund.status !== "processed")
      throw new Error("Refund is pending at the provider; reconciliation will retry.");
  }
  await retryConflict(async () => {
    const current = await records.get<Order>("ORDER", orderId);
    if (current?.value.payment.status === "refund_pending")
      await records.transaction([
        change("ORDER", orderId, current, {
          ...current.value,
          payment: { ...current.value.payment, status: "refunded" },
          version: (current.value.version ?? 0) + 1,
        }),
      ]);
  });
}
export async function updateOrderStatus(
  id: string,
  status: Order["status"],
  expectedVersion: number,
  admin: User,
): Promise<Order> {
  const row = await ownedOrder(id, admin);
  if ((row.value.version ?? 0) !== expectedVersion)
    throw new Error("Order changed. Refresh before updating.");
  if (status === "cancelled") return cancelOrder(id, admin);
  const next: Partial<Record<Order["status"], Order["status"]>> = {
    processing: "shipped",
    shipped: "delivered",
  };
  if (next[row.value.status] !== status) throw new Error("Invalid order status transition.");
  if (row.value.payment.method !== "cod" && row.value.payment.status !== "captured")
    throw new Error("Only a paid order can be shipped.");
  const value: Order = {
    ...row.value,
    status,
    payment: {
      ...row.value.payment,
      status:
        status === "delivered" && row.value.payment.method === "cod"
          ? "captured"
          : row.value.payment.status,
    },
    version: (row.value.version ?? 0) + 1,
  };
  await getRecords().transaction([
    change("ORDER", id, row, value),
    auditChange(admin.id, `order.${status}`, id),
  ]);
  if (status === "shipped") await queueOrderEmail(value, "shipping");
  return value;
}
export async function reconcileOrder(id: string) {
  const row = await getRecords().get<Order>("ORDER", id);
  if (!row) throw new Error("Order not found.");
  if (row.value.payment.status === "refund_pending") return refundOrder(id);
  if (
    row.value.status === "pending" &&
    row.value.providerOrderId &&
    getRuntimeConfig().mode === "cloud"
  ) {
    const result = await razorpay<{ items: ProviderPayment[] }>(
      `/orders/${encodeURIComponent(row.value.providerOrderId)}/payments`,
    );
    const captured = result.items.find((payment) => payment.status === "captured");
    if (captured) {
      await finalizePayment(id, captured.id);
      return;
    }
  }
  if (row.value.status === "pending" && (row.value.reservationExpiresAt ?? Infinity) < Date.now())
    await releaseAndCancel(id, "reservation.expired");
}
