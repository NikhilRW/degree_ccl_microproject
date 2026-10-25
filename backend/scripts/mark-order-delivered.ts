import { parseArgs } from "node:util";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";

// Operator-only utility. Never import into the app or expose as a server function.
// Credentials come from the normal AWS SDK chain; no customer input is trusted.
const { values } = parseArgs({ options: {
  table: { type: "string" }, "user-id": { type: "string" }, "order-id": { type: "string" },
  region: { type: "string", default: "ap-south-1" }, "confirm-received": { type: "boolean", default: false },
}, strict: true });
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const input = z.object({
  table: z.string().regex(/^[a-zA-Z0-9_.-]{3,255}$/), "user-id": identifier, "order-id": identifier,
  region: z.string().min(1), "confirm-received": z.literal(true),
}).parse(values);
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: input.region, maxAttempts: 3 }));
const Key = { pk: `USER#${input["user-id"]}`, sk: `ORDER#${input["order-id"]}` };
const { Item } = await db.send(new GetCommand({ TableName: input.table, Key, ConsistentRead: true }));
if (!Item || Item["entity"] !== "order" || Item["data"]?.userId !== input["user-id"] || Item["data"]?.id !== input["order-id"])
  throw new Error("The specified customer's persisted order was not found. No change made.");
if (Item["data"].status === "delivered") {
  console.log("Order is already delivered. No change made.");
} else {
  if (!["processing", "shipped"].includes(Item["data"].status)) throw new Error("Only processing or shipped orders can become delivered. Cancelled orders cannot be reopened.");
  try {
    await db.send(new UpdateCommand({ TableName: input.table, Key,
      UpdateExpression: "SET #data.#status = :delivered, deliveredAt = :now",
      ConditionExpression: "#entity = :entity AND #data.#user = :user AND #data.#id = :id AND (#data.#status = :processing OR #data.#status = :shipped)",
      ExpressionAttributeNames: { "#entity": "entity", "#data": "data", "#status": "status", "#user": "userId", "#id": "id" },
      ExpressionAttributeValues: { ":entity": "order", ":user": input["user-id"], ":id": input["order-id"],
        ":delivered": "delivered", ":processing": "processing", ":shipped": "shipped", ":now": new Date().toISOString() },
    }));
    console.log("Received order marked delivered. Its customer can now review the purchased products.");
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error;
    const latest = await db.send(new GetCommand({ TableName: input.table, Key, ConsistentRead: true }));
    if (latest.Item?.["data"]?.status !== "delivered" || latest.Item["data"].userId !== input["user-id"]) throw error;
    console.log("Order was already marked delivered by another operator. No further change made.");
  }
}
