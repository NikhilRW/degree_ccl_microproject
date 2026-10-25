import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamHandler, DynamoDBBatchResponse } from "aws-lambda";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import type { Order } from "../../src/types/index";

const ses = new SESv2Client({ region: process.env.AWS_REGION, maxAttempts: 3 });
export const handler: DynamoDBStreamHandler = async (event) => {
  const batchItemFailures: DynamoDBBatchResponse["batchItemFailures"] = [];
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" || !record.dynamodb?.NewImage) continue;
    const item = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
    if (item.entity !== "order") continue;
    try {
      const order = item.data as Order;
      await ses.send(
        new SendEmailCommand({
          FromEmailAddress: process.env.SENDER_EMAIL!,
          Destination: { ToAddresses: [item.recipient] },
          Content: {
            Simple: {
              Subject: { Data: `Your IntelliMart order ${order.id}`, Charset: "UTF-8" },
              Body: {
                Text: {
                  Charset: "UTF-8",
                  Data: [
                    `Hello ${order.address.fullName},`,
                    "",
                    `Thank you for your order ${order.id}.`,
                    "",
                    ...order.items.map(
                      (i) => `${i.name} x ${i.quantity}: INR ${i.price * i.quantity}`,
                    ),
                    "",
                    `Total due on delivery: INR ${order.totals.total}`,
                    "Payment method: Cash on delivery",
                    "",
                    `Ship to: ${order.address.address}, ${order.address.city}, ${order.address.state} ${order.address.postalCode}`,
                    "",
                    "IntelliMart",
                  ].join("\n"),
                },
              },
            },
          },
        }),
      );
    } catch (error) {
      console.error("Order email delivery failed", {
        eventId: record.eventID,
        error: error instanceof Error ? error.name : "UnknownError",
      });
      if (record.dynamodb.SequenceNumber)
        batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber });
    }
  }
  return { batchItemFailures };
};
