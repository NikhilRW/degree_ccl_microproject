import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import { AdminListGroupsForUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { PutCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { z } from "zod";
import type { Category, Product } from "../types";
import { productImageMaxBytes, productImageTypes, type createProductSchema, type productUploadSchema, type updatePriceSchema } from "../domain/contracts";
import { bucket, cognito, db, getItem, HttpError, presentProduct, queryItems, s3, table } from "./aws.server";
import { requireSession } from "./session.server";
import { categories } from "./catalogue.server";

const poolId = process.env["COGNITO_USER_POOL_ID"]!;
const groupName = "Admins";
interface UploadReceipt { contentType: string; size: number; expiresAt: number }

// No browser role, email allowlist or cached session role. Every admin RPC makes
// a fresh, pool-scoped membership lookup, so group removal revokes access.
export async function requireAdmin() {
  const { user } = await requireSession();
  let nextToken: string | undefined;
  do {
    const page = await cognito.send(new AdminListGroupsForUserCommand({
      UserPoolId: poolId, Username: user.id, NextToken: nextToken,
    })); // This email-sign-in pool uses Cognito-generated local usernames/subs.
    if (page.Groups?.some(group => group.GroupName === groupName)) return user;
    nextToken = page.NextToken;
  } while (nextToken);
  throw new HttpError(403, "This account does not have administrator access.", "ADMIN_REQUIRED");
}
export async function access() {
  await requireAdmin();
  return { allowed: true };
}
export async function listProducts() {
  await requireAdmin();
  return {
    products: await Promise.all((await queryItems<{ data: Product }>("CATALOG", "PRODUCT#")).map(item => presentProduct(item.data))),
    categories: await categories(),
  };
}
export async function uploadImage(input: z.infer<typeof productUploadSchema>) {
  const user = await requireAdmin();
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" }[input.contentType];
  const key = `products/admin/${user.id}/${randomUUID()}.${extension}`;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await db.send(new PutCommand({ TableName: table,
    Item: { pk: `ADMINUPLOAD#${user.id}`, sk: key, ...input, expiresAt },
    ConditionExpression: "attribute_not_exists(pk)",
  }));
  const post = await createPresignedPost(s3, {
    Bucket: bucket, Key: key, Expires: 300,
    Fields: { "Content-Type": input.contentType },
    Conditions: [
      ["eq", "$key", key], ["eq", "$Content-Type", input.contentType],
      ["content-length-range", input.size, input.size],
    ],
  });
  return { ...post, key };
}
export async function createProduct(input: z.infer<typeof createProductSchema>) {
  const user = await requireAdmin();
  const category = await getItem<{ data: Category }>("CATALOG", `CATEGORY#${input.categoryId}`);
  if (!category || category.data.id !== input.categoryId) throw new HttpError(400, "Choose an existing category.");
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const key of input.images) {
    if (!key.startsWith(`products/admin/${user.id}/`) || !/^products\/admin\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.(jpg|png|webp|avif)$/.test(key))
      throw new HttpError(400, "Use images uploaded through this administrator account.");
    const receipt = await getItem<UploadReceipt>(`ADMINUPLOAD#${user.id}`, key);
    if (!receipt || receipt.expiresAt <= nowSeconds) throw new HttpError(400, "This image upload expired or was already used. Upload it again.");
    let object;
    try { object = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); }
    catch (error) {
      if (error instanceof Error && ["NotFound", "NoSuchKey"].includes(error.name)) throw new HttpError(400, "Finish uploading every image before adding the product.");
      throw error;
    }
    if (!productImageTypes.some(type => type === object.ContentType) || object.ContentType !== receipt.contentType ||
      object.ContentLength !== receipt.size || receipt.size < 1 || receipt.size > productImageMaxBytes)
      throw new HttpError(400, "An uploaded image has an invalid type or size.");
  }
  const id = randomUUID();
  const data: Product = {
    id, slug: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "product"}-${id}`,
    name: input.name, categoryId: category.data.id, category: category.data.name,
    description: input.description, price: input.price, originalPrice: input.originalPrice ?? input.price,
    stock: input.stock, images: input.images.map(key => `s3://${bucket}/${key}`),
    rating: 0, reviewCount: 0, highlights: [], specifications: {}, tags: [], featured: false,
    createdAt: new Date().toISOString(),
  };
  await db.send(new TransactWriteCommand({ TransactItems: [
    { Put: { TableName: table, Item: { pk: "CATALOG", sk: `PRODUCT#${id}`, data, ratingTotal: 0 }, ConditionExpression: "attribute_not_exists(pk)" } },
    { Update: { TableName: table, Key: { pk: "CATALOG", sk: `CATEGORY#${category.data.id}` },
      UpdateExpression: "SET #data.#count = if_not_exists(#data.#count, :zero) + :one",
      ConditionExpression: "attribute_exists(pk) AND #data.#name = :name",
      ExpressionAttributeNames: { "#data": "data", "#count": "productCount", "#name": "name" },
      ExpressionAttributeValues: { ":zero": 0, ":one": 1, ":name": category.data.name },
    } },
    ...input.images.map(key => ({ Delete: { TableName: table, Key: { pk: `ADMINUPLOAD#${user.id}`, sk: key },
      ConditionExpression: "attribute_exists(pk) AND expiresAt > :now", ExpressionAttributeValues: { ":now": nowSeconds },
    } })),
  ] }));
  return presentProduct(data);
}
export async function updatePrice(input: z.infer<typeof updatePriceSchema>) {
  await requireAdmin();
  await db.send(new UpdateCommand({ TableName: table, Key: { pk: "CATALOG", sk: `PRODUCT#${input.productId}` },
    UpdateExpression: "SET #data.#price = :price, #data.#original = :original, updatedAt = :now",
    ConditionExpression: "attribute_exists(pk) AND #data.#price = :expectedPrice AND #data.#original = :expectedOriginal",
    ExpressionAttributeNames: { "#data": "data", "#price": "price", "#original": "originalPrice" },
    ExpressionAttributeValues: { ":price": input.price, ":original": input.originalPrice,
      ":expectedPrice": input.expectedPrice, ":expectedOriginal": input.expectedOriginalPrice, ":now": new Date().toISOString() },
  }));
  return { productId: input.productId, price: input.price, originalPrice: input.originalPrice };
}
