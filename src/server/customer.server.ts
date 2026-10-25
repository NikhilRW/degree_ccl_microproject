import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  PutCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { z } from "zod";
import type { Cart, Order, User, WishlistItem } from "../types/index";
import { calculateCartTotals } from "../domain/cartTotals";
import type { analyticsSchema, cartChangeSchema, fileSchema, orderSchema, uploadSchema } from "../domain/contracts";
import {
  bucket,
  db,
  getItem,
  HttpError,
  id,
  imageUrl,
  presentProduct,
  product,
  queryItems,
  s3,
  table,
} from "./aws.server";

interface StoredCart {
  pk: string;
  sk: string;
  productId: string;
  quantity: number;
  savedForLater: boolean;
  revision: string;
}
interface StoredOrder {
  pk: string;
  sk: string;
  data: Order;
  recipient: string;
  entity: "order";
}
async function readCart(pk: string): Promise<{ cart: Cart; stored: StoredCart[] }> {
  const stored = await queryItems<StoredCart>(pk, "CART#");
  const items = await Promise.all(
    stored.map(async (item) => ({
      productId: item.productId,
      quantity: item.quantity,
      savedForLater: item.savedForLater,
      product: await product(item.productId),
    })),
  );
  return { cart: { items, updatedAt: new Date().toISOString() }, stored };
}
async function presentCart(pk: string) {
  const { cart } = await readCart(pk);
  return {
    ...cart,
    items: await Promise.all(
      cart.items.map(async (item) => ({ ...item, product: await presentProduct(item.product) })),
    ),
  };
}
async function orderFor(pk: string, orderId: string) {
  const entry = await getItem<StoredOrder>(pk, `ORDER#${id(orderId)}`);
  if (!entry) throw new HttpError(404, "Order not found.");
  return entry;
}
async function presentOrder(order: Order) {
  return {
    ...order,
    items: await Promise.all(
      order.items.map(async (item) => ({ ...item, image: await imageUrl(item.image) })),
    ),
  };
}

export async function getCart(user: User) {
  return presentCart(`USER#${user.id}`);
}
export async function changeCart(user: User, input: z.infer<typeof cartChangeSchema>) {
  const pk = `USER#${user.id}`;
  if (input.action === "clear") {
    const items = await queryItems<StoredCart>(pk, "CART#");
    for (let offset = 0; offset < items.length; offset += 25) {
      await db.send(
        new TransactWriteCommand({
          TransactItems: items.slice(offset, offset + 25).map((item) => ({
            Delete: {
              TableName: table,
              Key: { pk, sk: item.sk },
              ConditionExpression: "revision = :revision",
              ExpressionAttributeValues: { ":revision": item.revision },
            },
          })),
        }),
      );
    }
    return presentCart(pk);
  }
  {
    const productId = input.productId;
    const key = { pk, sk: `CART#${productId}` };
    if (input.action === "remove") {
      await db.send(new DeleteCommand({ TableName: table, Key: key }));
    } else if (input.action === "saved") {
      const current = await getItem<StoredCart>(pk, key.sk);
      if (!current) throw new HttpError(404, "Cart item not found.");
      await db.send(
        new UpdateCommand({
          TableName: table,
          Key: key,
          UpdateExpression: "SET savedForLater = :saved, revision = :next",
          ConditionExpression: "revision = :revision",
          ExpressionAttributeValues: {
            ":saved": !current.savedForLater,
            ":next": randomUUID(),
            ":revision": current.revision,
          },
        }),
      );
    } else {
      const { quantity } = input;
      const p = await product(productId);
      const current = await getItem<StoredCart>(pk, key.sk);
      const nextQuantity = input.action === "add" ? (current?.quantity ?? 0) + quantity : quantity;
      if (nextQuantity > p.stock || nextQuantity > 99)
        throw new HttpError(409, "Not enough stock for that quantity.");
      if (!current && (await queryItems(pk, "CART#")).length >= 25)
        throw new HttpError(400, "Your bag can contain up to 25 different products.");
      if (nextQuantity === 0) {
        if (current)
          await db.send(
            new DeleteCommand({
              TableName: table,
              Key: key,
              ConditionExpression: "revision = :revision",
              ExpressionAttributeValues: { ":revision": current.revision },
            }),
          );
      } else {
        await db.send(
          new PutCommand({
            TableName: table,
            Item: {
              ...key,
              productId,
              quantity: nextQuantity,
              savedForLater: input.action === "add" ? false : (current?.savedForLater ?? false),
              revision: randomUUID(),
            },
            ConditionExpression: current ? "revision = :revision" : "attribute_not_exists(pk)",
            ...(current ? { ExpressionAttributeValues: { ":revision": current.revision } } : {}),
          }),
        );
      }
    }
    return presentCart(pk);
  }
}
export async function listWishlist(user: User) {
  return (await queryItems<{ data: WishlistItem }>(`USER#${user.id}`, "WISH#")).map(item => item.data);
}
export async function changeWishlist(user: User, productId: string, remove: boolean) {
    const pk = `USER#${user.id}`;
    const key = { pk, sk: `WISH#${productId}` };
    if (remove) await db.send(new DeleteCommand({ TableName: table, Key: key }));
    else {
      await product(productId);
      await db.send(
        new PutCommand({
          TableName: table,
          Item: { ...key, data: { productId, addedAt: new Date().toISOString() } },
        }),
      );
    }
    return (await queryItems<{ data: WishlistItem }>(pk, "WISH#")).map((item) => item.data);
}
export async function listOrders(user: User) {
  const pk = `USER#${user.id}`;
    return Promise.all(
      (await queryItems<StoredOrder>(pk, "ORDER#"))
        .map((item) => item.data)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(presentOrder),
    );
}
export async function createOrder(user: User, input: z.infer<typeof orderSchema>) {
    const userId = user.id;
    const pk = `USER#${userId}`;
    const requestKey = `REQUEST#${input.idempotencyKey}`;
    const previous = await getItem<{ orderId: string }>(pk, requestKey);
    if (previous) return presentOrder((await orderFor(pk, previous.orderId)).data);
    const { cart, stored } = await readCart(pk);
    const active = cart.items.filter((item) => !item.savedForLater);
    if (!active.length) throw new HttpError(400, "Your bag is empty.");
    if (active.length > 25)
      throw new HttpError(400, "Place orders with no more than 25 different products.");
    const totals = calculateCartTotals(cart, input.delivery);
    if (totals.total !== input.expectedTotal)
      throw new HttpError(
        409,
        "Prices have changed. Refresh your bag and review the updated total.",
      );
    const now = new Date();
    const order: Order = {
      id: `IM-${now.getFullYear()}-${randomUUID()}`,
      userId,
      address: input.address,
      delivery: input.delivery,
      items: active.map((item) => {
        const image = item.product.images[0];
        if (!image) throw new HttpError(409, "A product image is missing. Contact the store administrator.");
        return {
        productId: item.productId,
        quantity: item.quantity,
        name: item.product.name,
        price: item.product.price,
        image,
      }; }),
      totals,
      payment: {
        id: randomUUID(),
        method: input.method,
        status: input.method === "cod" ? "pending" : "mocked",
        amount: totals.total,
        ...(input.method === "cod" ? {} : { simulated: true }),
      },
      status: "processing",
      createdAt: now.toISOString(),
      estimatedDelivery: new Date(
        now.getTime() + (input.delivery === "express" ? 2 : 6) * 86400000,
      ).toISOString(),
    };
    const changes: NonNullable<
      ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
    > = [];
    for (const item of active) {
      const revision = stored.find((entry) => entry.productId === item.productId)!.revision;
      changes.push({
        Update: {
          TableName: table,
          Key: { pk: "CATALOG", sk: `PRODUCT#${item.productId}` },
          UpdateExpression: "SET #data.#stock = #data.#stock - :quantity",
          ConditionExpression: "#data.#stock >= :quantity AND #data.#price = :price",
          ExpressionAttributeNames: { "#data": "data", "#stock": "stock", "#price": "price" },
          ExpressionAttributeValues: { ":quantity": item.quantity, ":price": item.product.price },
        },
      });
      changes.push({
        Delete: {
          TableName: table,
          Key: { pk, sk: `CART#${item.productId}` },
          ConditionExpression: "revision = :revision",
          ExpressionAttributeValues: { ":revision": revision },
        },
      });
    }
    changes.push({
      Put: {
        TableName: table,
        Item: { pk, sk: `ORDER#${order.id}`, entity: "order", recipient: user.email, data: order },
        ConditionExpression: "attribute_not_exists(pk)",
      },
    });
    changes.push({
      Put: {
        TableName: table,
        Item: {
          pk,
          sk: requestKey,
          orderId: order.id,
          expiresAt: Math.floor(Date.now() / 1000) + 604800,
        },
        ConditionExpression: "attribute_not_exists(pk)",
      },
    });
    try {
      await db.send(new TransactWriteCommand({ TransactItems: changes }));
    } catch (error) {
      const completed = await getItem<{ orderId: string }>(pk, requestKey);
      if (completed) return presentOrder((await orderFor(pk, completed.orderId)).data);
      throw error;
    }
    return presentOrder(order);
}
export async function getOrder(user: User, orderId: string) {
  return presentOrder((await orderFor(`USER#${user.id}`, orderId)).data);
}
export async function cancelOrder(user: User, orderId: string) {
    const pk = `USER#${user.id}`;
    const entry = await orderFor(pk, orderId);
      if (entry.data.status === "cancelled") return presentOrder(entry.data);
      if (entry.data.status !== "processing")
        throw new HttpError(409, "This order can no longer be cancelled.");
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: table,
                Key: { pk, sk: entry.sk },
                UpdateExpression: "SET #data.#status = :cancelled",
                ConditionExpression: "#data.#status = :processing",
                ExpressionAttributeNames: { "#data": "data", "#status": "status" },
                ExpressionAttributeValues: {
                  ":cancelled": "cancelled",
                  ":processing": "processing",
                },
              },
            },
            ...entry.data.items.map((item) => ({
              Update: {
                TableName: table,
                Key: { pk: "CATALOG", sk: `PRODUCT#${item.productId}` },
                UpdateExpression: "SET #data.#stock = #data.#stock + :quantity",
                ConditionExpression: "attribute_exists(pk)",
                ExpressionAttributeNames: { "#data": "data", "#stock": "stock" },
                ExpressionAttributeValues: { ":quantity": item.quantity },
              },
            })),
          ],
        }),
      );
      return presentOrder({ ...entry.data, status: "cancelled" });
}
export async function uploadFile(user: User, input: z.infer<typeof uploadSchema>) {
    const userId = user.id;
    const name = input.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `customers/${userId}/${randomUUID()}-${name}`;
    const post = await createPresignedPost(s3, {
      Bucket: bucket,
      Key: key,
      Expires: 300,
      Fields: { "Content-Type": input.contentType },
      Conditions: [
        ["content-length-range", 1, input.size],
        ["eq", "$Content-Type", input.contentType],
      ],
    });
    return {
      ...post,
      key,
      fileUrl: await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: 900,
      }),
    };
}
export async function accessFile(user: User, input: z.infer<typeof fileSchema>) {
    const userId = user.id;
    if (!input.key.startsWith(`customers/${userId}/`))
      throw new HttpError(403, "You cannot access this file.");
    if (input.remove) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: input.key }));
      return { url: "", deleted: true };
    }
    return {
      url: await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: input.key }), {
        expiresIn: 900,
      }),
    };
}
export async function recordAnalytics(user: User, input: z.infer<typeof analyticsSchema>) {
    const pk = `USER#${user.id}`;
    if (JSON.stringify(input).length > 8192)
      throw new HttpError(400, "Analytics payload is too large.");
    await db.send(
      new PutCommand({
        TableName: table,
        Item: {
          pk,
          sk: `EVENT#${Date.now()}#${randomUUID()}`,
          data: input,
          expiresAt: Math.floor(Date.now() / 1000) + 2592000,
        },
      }),
    );
    return { recorded: true };
}
