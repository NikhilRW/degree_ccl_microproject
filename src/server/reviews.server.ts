import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { z } from "zod";
import type { Order, Product, Review, ReviewEligibility, User } from "../types";
import type { reviewSchema } from "../domain/contracts";
import { db, getItem, HttpError, product, queryItems, table } from "./aws.server";

interface StoredOrder { pk: string; sk: string; entity: string; data: Order }
const reviewKey = (user: User, productId: string) => ({ pk: `PRODUCT#${productId}`, sk: `REVIEW#USER#${user.id}` });
async function ownReview(user: User, productId: string) {
  const key = reviewKey(user, productId);
  return (await getItem<{ data: Review }>(key.pk, key.sk))?.data ?? null;
}
async function deliveredPurchase(user: User, productId: string) {
  return (await queryItems<StoredOrder>(`USER#${user.id}`, "ORDER#")).find(order =>
    order.entity === "order" && order.data.userId === user.id && order.data.status === "delivered" &&
    order.data.items.some(item => item.productId === productId && item.quantity > 0));
}
export async function eligibility(user: User, productId: string): Promise<ReviewEligibility> {
  await product(productId);
  const review = await ownReview(user, productId);
  if (review) return { canReview: false, reason: "You have already reviewed this product.", review };
  const order = await deliveredPurchase(user, productId);
  return { canReview: !!order, reason: order ? "Your delivered purchase is eligible for a review." :
    "Reviews open after an order for this product is recorded as delivered. An estimated delivery date does not confirm receipt.", review: null };
}
export async function submitReview(user: User, input: z.infer<typeof reviewSchema>) {
  const key = reviewKey(user, input.productId);
  const review: Review = { id: randomUUID(), productId: input.productId,
    author: user.name, rating: input.rating, title: input.title, body: input.body,
    verifiedPurchase: true, createdAt: new Date().toISOString() };
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await ownReview(user, input.productId)) throw new HttpError(409, "You have already reviewed this product.", "ALREADY_REVIEWED");
    const order = await deliveredPurchase(user, input.productId);
    if (!order) throw new HttpError(403, "Only your own delivered purchase can be reviewed.", "DELIVERED_PURCHASE_REQUIRED");
    const itemIndex = order.data.items.findIndex(item => item.productId === input.productId && item.quantity > 0);
    const entry = await getItem<{ data: Product; ratingTotal?: number }>("CATALOG", `PRODUCT#${input.productId}`);
    if (!entry) throw new HttpError(404, "Product not found.");
    const p = entry.data;
    // Preserve legacy display aggregates. Never reconstruct future sums from a
    // rounded average; the internal total becomes the authoritative sum.
    const base = entry.ratingTotal ?? Math.round(p.rating * p.reviewCount * 1_000_000) / 1_000_000;
    const total = base + input.rating;
    const count = p.reviewCount + 1;
    try {
      await db.send(new TransactWriteCommand({ TransactItems: [
        { ConditionCheck: { TableName: table, Key: { pk: `USER#${user.id}`, sk: order.sk },
          ConditionExpression: `#entity = :entity AND #data.#user = :user AND #data.#status = :delivered AND #data.#items[${itemIndex}].#product = :product AND #data.#items[${itemIndex}].#quantity > :zero`,
          ExpressionAttributeNames: { "#entity": "entity", "#data": "data", "#user": "userId", "#status": "status", "#items": "items", "#product": "productId", "#quantity": "quantity" },
          ExpressionAttributeValues: { ":entity": "order", ":user": user.id, ":delivered": "delivered", ":product": input.productId, ":zero": 0 },
        } },
        { Put: { TableName: table, Item: { ...key, userId: user.id, data: review }, ConditionExpression: "attribute_not_exists(pk)" } },
        { Update: { TableName: table, Key: { pk: "CATALOG", sk: `PRODUCT#${input.productId}` },
          UpdateExpression: "SET #data.#rating = :rating, #data.#count = :count, ratingTotal = :total",
          ConditionExpression: `attribute_exists(pk) AND #data.#rating = :oldRating AND #data.#count = :oldCount AND ${entry.ratingTotal === undefined ? "attribute_not_exists(ratingTotal)" : "ratingTotal = :oldTotal"}`,
          ExpressionAttributeNames: { "#data": "data", "#rating": "rating", "#count": "reviewCount" },
          ExpressionAttributeValues: { ":rating": Number((total / count).toFixed(6)), ":count": count, ":total": total,
            ":oldRating": p.rating, ":oldCount": p.reviewCount, ...(entry.ratingTotal === undefined ? {} : { ":oldTotal": entry.ratingTotal }) },
        } },
      ] }));
      return { review, rating: Number((total / count).toFixed(6)), reviewCount: count };
    } catch (error) {
      if (!(error instanceof TransactionCanceledException)) throw error;
      const reasons = error.CancellationReasons;
      if (reasons?.[1]?.Code === "ConditionalCheckFailed") throw new HttpError(409, "You have already reviewed this product.", "ALREADY_REVIEWED");
      // Retry only aggregate races or transaction contention. The next attempt
      // rechecks ownership, persisted delivery and duplicate status as well.
      if (reasons?.[2]?.Code !== "ConditionalCheckFailed" && !reasons?.some(reason => reason.Code === "TransactionConflict")) throw error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }
  throw new HttpError(409, "Reviews changed while saving. Please try again.", "REVIEW_CONFLICT");
}
