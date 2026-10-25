import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { randomUUID } from "node:crypto";
import type { Order, User } from "@/types";
import { getRuntimeConfig } from "./runtime.server";
import { getAwsClients } from "./clients.server";
import { change, getRecords, retryConflict } from "./records.server";

interface Notice {
  orderId: string;
  userId?: string;
  type: "confirmation" | "shipping" | "welcome";
  email: string;
  status: "pending" | "sending" | "sent" | "failed";
  leaseUntil: number;
  owner: string;
  attempts: number;
}
export async function queueWelcomeEmail(user: User) {
  const id = `welcome#${user.id}`;
  try {
    await retryConflict(async () => {
      if (await getRecords().get("NOTICE", id)) return;
      await getRecords().transaction([
        change("NOTICE", id, null, {
          orderId: "",
          userId: user.id,
          email: user.email,
          type: "welcome",
          status: "pending",
          leaseUntil: 0,
          owner: "",
          attempts: 0,
        } satisfies Notice),
      ]);
    });
    await sendNotice(id);
  } catch {
    console.warn(JSON.stringify({ event: "email.welcome_retry_pending" }));
  }
}
export async function queueOrderEmail(order: Order, type: "confirmation" | "shipping") {
  if (!order.customerEmail) return;
  const email = order.customerEmail;
  const id = `${order.id}#${type}`;
  try {
    await retryConflict(async () => {
      if (await getRecords().get("NOTICE", id)) return;
      await getRecords().transaction([
        {
          kind: "NOTICE",
          id,
          expected: null,
          value: {
            orderId: order.id,
            type,
            email,
            status: "pending",
            leaseUntil: 0,
            owner: "",
            attempts: 0,
          } satisfies Notice,
        },
      ]);
    });
  } catch {
    console.warn(JSON.stringify({ event: "email.queue_retry_pending", orderId: order.id }));
    return;
  }
  try {
    await sendNotice(id);
  } catch {
    console.warn(JSON.stringify({ event: "email.retry_pending", orderId: order.id }));
  }
}
export async function sendNotice(id: string) {
  const config = getRuntimeConfig();
  const owner = randomUUID();
  const acquired = await retryConflict(async () => {
    const row = await getRecords().get<Notice>("NOTICE", id);
    if (!row || row.value.status === "sent" || row.value.leaseUntil > Date.now()) return false;
    await getRecords().transaction([
      change("NOTICE", id, row, {
        ...row.value,
        owner,
        status: "sending",
        attempts: row.value.attempts + 1,
        leaseUntil: Date.now() + 60000,
      }),
    ]);
    return true;
  });
  if (!acquired) return;
  const row = await getRecords().get<Notice>("NOTICE", id);
  const order = row ? await getRecords().get<Order>("ORDER", row.value.orderId) : null;
  if (!row || (!order && row.value.type !== "welcome"))
    throw new Error("Notification order is unavailable.");
  let success = false;
  try {
    const subject =
      row.value.type === "welcome"
        ? "Welcome to IntelliMart"
        : row.value.type === "confirmation"
          ? `IntelliMart order ${order!.id} confirmed`
          : `IntelliMart order ${order!.id} shipped`;
    const text =
      row.value.type === "welcome"
        ? `Welcome to the IntelliMart cloud computing lab!\nBrowse products and manage your account: ${config.appUrl}/account\nPayments are test-only.`
        : `${subject}\n\n${order!.value.items.map((item) => `${item.name} × ${item.quantity}`).join("\n")}\n\nTotal: INR ${order!.value.totals.total.toFixed(2)}\nStatus: ${order!.value.status}\nView your orders: ${config.appUrl}/account\n\nCloud computing lab: Razorpay transactions are in test mode.`;
    if (config.mode === "cloud")
      await getAwsClients().ses.send(
        new SendEmailCommand({
          FromEmailAddress: config.emailFrom,
          Destination: { ToAddresses: [row.value.email] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: "UTF-8" },
              Body: { Text: { Data: text, Charset: "UTF-8" } },
            },
          },
        }),
      );
    else
      console.info(
        JSON.stringify({
          event: "demo.email_simulated",
          orderId: order?.id ?? "",
          type: row.value.type,
        }),
      );
    success = true;
  } finally {
    await retryConflict(async () => {
      const current = await getRecords().get<Notice>("NOTICE", id);
      if (current?.value.owner === owner) {
        const changes = [
          change("NOTICE", id, current, {
            ...current.value,
            status: success ? "sent" : "failed",
            leaseUntil: Date.now() + (success ? 0 : 300000),
          }),
        ];
        if (current.value.type === "confirmation") {
          const latestOrder = await getRecords().get<Order>("ORDER", current.value.orderId);
          if (latestOrder)
            changes.push(
              change("ORDER", latestOrder.id, latestOrder, {
                ...latestOrder.value,
                notificationStatus: success ? "sent" : "failed",
              }),
            );
        }
        await getRecords().transaction(changes);
      }
    });
  }
}
export async function retryNotices() {
  let cursor = "";
  do {
    const page = await getRecords().page<Notice>("NOTICE", cursor);
    for (const row of page.rows)
      if (row.value.status !== "sent" && row.value.leaseUntil < Date.now()) {
        try {
          await sendNotice(row.id);
        } catch {
          console.warn(JSON.stringify({ event: "email.retry_failed", orderId: row.value.orderId }));
        }
      }
    cursor = page.cursor;
  } while (cursor);
}
