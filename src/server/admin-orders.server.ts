import "@tanstack/react-start/server-only";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";
import type { AdminOrderSummary, Order } from "../types";
import { adminOrderCursorSchema, adminOrderStatusSchema, adminOrdersSchema, idSchema, orderStatusSchema } from "../domain/contracts";
import { db, getItem, HttpError, table } from "./aws.server";
import { requireAdmin } from "./admin.server";

interface StoredOrder { entity: string; data: Order }
const indexName = "OrdersByEntity";
const pageSize = 25;
type Cursor = z.infer<typeof adminOrderCursorSchema>;

function cursorFor(pk: unknown, sk: unknown): Cursor {
  if (typeof pk !== "string" || !pk.startsWith("USER#") || typeof sk !== "string" || !sk.startsWith("ORDER#"))
    throw new HttpError(500, "An indexed order has an invalid key. Contact the store operator.");
  return adminOrderCursorSchema.parse({ ownerId: pk.slice(5), orderId: sk.slice(6) });
}
function checkedOrder(entry: StoredOrder | undefined, ownerId: string, orderId: string): Order {
  if (!entry || entry.entity !== "order") throw new HttpError(404, "Order not found.");
  if (entry.data.userId !== ownerId || entry.data.id !== orderId || !orderStatusSchema.safeParse(entry.data.status).success)
    throw new HttpError(409, "The stored order identity or status is invalid. Contact the store operator.");
  return entry.data;
}
function summarize(order: Order): AdminOrderSummary {
  return {
    id: order.id, ownerId: order.userId, customerName: order.address.fullName,
    createdAt: order.createdAt, total: order.totals.total, status: order.status,
    items: order.items.map(({ productId, name, quantity, price }) => ({ productId, name, quantity, price })),
  };
}
export async function listOrders(input: z.infer<typeof adminOrdersSchema>) {
  await requireAdmin();
  const page = await db.send(new QueryCommand({
    TableName: table, IndexName: indexName,
    KeyConditionExpression: "#entity = :order",
    ExpressionAttributeNames: { "#entity": "entity" }, ExpressionAttributeValues: { ":order": "order" },
    Limit: pageSize, ScanIndexForward: false,
    ...(input.cursor ? { ExclusiveStartKey: { pk: `USER#${input.cursor.ownerId}`, sk: `ORDER#${input.cursor.orderId}`, entity: "order" } } : {}),
    // GSI queries are eventually consistent; never request ConsistentRead here.
  }));
  const orders = await Promise.all((page.Items ?? []).map(async row => {
    const { ownerId, orderId } = cursorFor(row["pk"], row["sk"]);
    // Strong base-table reads prevent stale GSI status data after a successful
    // update. Only validated USER#/ORDER# keys are read, never session records.
    const current = checkedOrder(await getItem<StoredOrder>(`USER#${ownerId}`, `ORDER#${orderId}`), ownerId, orderId);
    return summarize(current);
  }));
  return {
    orders,
    nextCursor: page.LastEvaluatedKey ? cursorFor(page.LastEvaluatedKey["pk"], page.LastEvaluatedKey["sk"]) : null,
  };
}

export async function updateOrderStatus(input: z.infer<typeof adminOrderStatusSchema>) {
  const actor = await requireAdmin();
  const key = { pk: `USER#${input.ownerId}`, sk: `ORDER#${input.orderId}` };
  const order = checkedOrder(await getItem<StoredOrder>(key.pk, key.sk), input.ownerId, input.orderId);
  // Retrying a completed request is a no-op, even when its old expected status
  // was consumed by that successful request. Never repeat inventory changes.
  if (order.status === input.status) return summarize(order);
  if (order.status !== input.expectedStatus)
    throw new HttpError(409, "This order changed elsewhere. Refresh it before changing its status.", "ORDER_STATUS_CONFLICT");
  const releasing = input.status === "cancelled";
  const reserving = order.status === "cancelled";
  const quantities = new Map<string, number>();
  if (releasing || reserving) {
    if (!Array.isArray(order.items) || order.items.length < 1 || order.items.length > 25)
      throw new HttpError(409, "This order has invalid inventory lines. Contact the store operator.");
    for (const item of order.items) {
      if (!idSchema.safeParse(item.productId).success || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99)
        throw new HttpError(409, "This order has invalid inventory quantities. Contact the store operator.");
      // Combine any repeated product IDs into one transaction update per key.
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }
  }
  const now = new Date().toISOString();
  const changes: NonNullable<ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]> = [{
    Update: {
      TableName: table, Key: key,
      UpdateExpression: `SET #data.#status = :next, statusUpdatedAt = :now, statusUpdatedBy = :actor${input.status === "delivered" ? ", deliveredAt = :now" : ""}`,
      // Whole-data equality protects ownership, quantities and historical order
      // values between our strong read and the inventory transaction.
      ConditionExpression: "#entity = :order AND #data.#status = :old AND #data = :snapshot",
      ExpressionAttributeNames: { "#entity": "entity", "#data": "data", "#status": "status" },
      ExpressionAttributeValues: { ":order": "order", ":next": input.status, ":old": order.status,
        ":snapshot": order, ":now": now, ":actor": actor.id },
    },
  }];
  for (const [productId, quantity] of quantities) {
    changes.push({ Update: {
      TableName: table, Key: { pk: "CATALOG", sk: `PRODUCT#${productId}` },
      UpdateExpression: `SET #data.#stock = #data.#stock ${releasing ? "+" : "-"} :quantity`,
      ConditionExpression: `attribute_exists(pk) AND #data.#stock >= ${reserving ? ":quantity" : ":zero"}`,
      ExpressionAttributeNames: { "#data": "data", "#stock": "stock" },
      ExpressionAttributeValues: { ":quantity": quantity, ...(reserving ? {} : { ":zero": 0 }) },
    } });
  }
  try {
    await db.send(new TransactWriteCommand({ TransactItems: changes }));
  } catch (error) {
    if (!(error instanceof TransactionCanceledException)) throw error;
    const current = checkedOrder(await getItem<StoredOrder>(key.pk, key.sk), input.ownerId, input.orderId);
    if (current.status === input.status) return summarize(current); // Concurrent identical update won.
    if (current.status !== order.status || error.CancellationReasons?.[0]?.Code === "ConditionalCheckFailed")
      throw new HttpError(409, "This order changed elsewhere. Refresh it before changing its status.", "ORDER_STATUS_CONFLICT");
    if (error.CancellationReasons?.slice(1).some(reason => reason.Code === "ConditionalCheckFailed"))
      throw new HttpError(409, reserving ? "Cannot reopen this order: a product is missing or does not have enough stock. No status or inventory was changed." :
        "Cannot cancel this order: a product is missing or its stock is invalid. No status or inventory was changed.", "ORDER_INVENTORY_CONFLICT");
    throw new HttpError(409, "This order or its stock is being updated. Refresh and try again.", "ORDER_STATUS_CONFLICT");
  }
  return summarize({ ...order, status: input.status });
}
