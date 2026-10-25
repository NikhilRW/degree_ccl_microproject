import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import "@tanstack/react-start/server-only";
import type { Product, User } from "../types/index";
import { HttpError, idSchema } from "../domain/contracts";
export { HttpError, idSchema } from "../domain/contracts";

export const config = { ...(process.env["AWS_REGION"] ? { region: process.env["AWS_REGION"] } : {}), maxAttempts: 3 };
export const db = DynamoDBDocumentClient.from(new DynamoDBClient(config), {
  marshallOptions: { removeUndefinedValues: true },
});
export const s3 = new S3Client(config);
export const cognito = new CognitoIdentityProviderClient(config);
export const table = process.env["TABLE_NAME"]!;
export const bucket = process.env["MEDIA_BUCKET"]!;
export const clientId = process.env["COGNITO_CLIENT_ID"]!;
export async function getUser(token: string): Promise<User> {
  const result = await cognito.send(new GetUserCommand({ AccessToken: token }));
  const attributes = new Map((result.UserAttributes ?? []).map(a => [a.Name, a.Value]));
  const sub = attributes.get("sub");
  const email = attributes.get("email");
  if (!sub || !email || attributes.get("email_verified") !== "true")
    throw new HttpError(403, "Verify your email before placing an order.");
  return {
    id: sub,
    name: attributes.get("name") ?? email,
    email,
    addresses: [],
  };
}
export async function getItem<T>(pk: string, sk: string): Promise<T | undefined> {
  const result = await db.send(
    new GetCommand({ TableName: table, Key: { pk, sk }, ConsistentRead: true }),
  );
  return result.Item as T | undefined;
}
export async function queryItems<T>(pk: string, prefix: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: ConstructorParameters<typeof QueryCommand>[0]["ExclusiveStartKey"];
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": pk, ":prefix": prefix },
        ExclusiveStartKey: cursor,
        ConsistentRead: true,
      }),
    );
    items.push(...((page.Items ?? []) as T[]));
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return items;
}
export function id(value: string) {
  const result = idSchema.safeParse(value);
  if (!result.success) throw new HttpError(400, "Invalid item identifier.");
  return result.data;
}
export async function product(idValue: string) {
  const item = await getItem<{ data: Product }>("CATALOG", `PRODUCT#${id(idValue)}`);
  if (!item) throw new HttpError(404, "Product not found.");
  return item.data;
}
export async function imageUrl(key: string) {
  if (!key.startsWith("s3://")) return key;
  const objectKey = key.replace(`s3://${bucket}/`, "");
  if (objectKey === key)
    throw new HttpError(500, "Product image bucket is not configured correctly.");
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), {
    expiresIn: 900,
  });
}
export async function presentProduct(p: Product) {
  return { ...p, images: await Promise.all(p.images.map(imageUrl)) };
}
