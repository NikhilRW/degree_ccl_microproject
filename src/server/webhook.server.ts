import { createHash } from "node:crypto";
import { z } from "zod";
import { getRuntimeConfig } from "./runtime.server";
import { getPaymentSecrets } from "./razorpay.server";
import { verifyHmac } from "./payment-security";
import { change, getRecords, retryConflict } from "./records.server";
import { finalizePayment } from "./orders.server";

export async function readLimitedBody(request: Request, limit = 65536) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Request body too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
interface EventState {
  done: boolean;
  until: number;
  expiresAt: number;
}
export async function handleRazorpayWebhook(request: Request): Promise<Response> {
  if (getRuntimeConfig().mode !== "cloud")
    return Response.json({ error: "Cloud payments are not configured" }, { status: 503 });
  let body: string;
  try {
    body = await readLimitedBody(request);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 413 });
  }
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const keys = await getPaymentSecrets();
  if (!verifyHmac(body, signature, keys.webhookSecret))
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = z
    .object({
      event: z.string(),
      payload: z.object({
        payment: z
          .object({
            entity: z.object({
              id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
              order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
            }),
          })
          .optional(),
      }),
    })
    .safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Invalid event" }, { status: 400 });
  if (!["payment.captured", "order.paid"].includes(parsed.data.event))
    return Response.json({ received: true, ignored: true });
  const payment = parsed.data.payload.payment?.entity;
  if (!payment) return Response.json({ error: "Missing payment" }, { status: 400 });
  const id = createHash("sha256").update(body).digest("hex");
  const acquired = await retryConflict(async () => {
    const row = await getRecords().get<EventState>("WEBHOOK", id);
    if (row?.value.done) return "done";
    if (row && row.value.until > Date.now()) return "busy";
    await getRecords().transaction([
      change("WEBHOOK", id, row, {
        done: false,
        until: Date.now() + 60000,
        expiresAt: Date.now() + 30 * 86400000,
      }),
    ]);
    return "acquired";
  });
  if (acquired === "done") return Response.json({ received: true, duplicate: true });
  // A retryable response is essential: returning success while another worker
  // later crashes could otherwise discard the only delivered event.
  if (acquired === "busy")
    return Response.json({ error: "Event is being processed" }, { status: 503 });
  try {
    const mapping = await getRecords().get<{ orderId: string }>("PROVIDER_ORDER", payment.order_id);
    if (!mapping) throw new Error("Provider order mapping is not available yet.");
    await finalizePayment(mapping.value.orderId, payment.id);
    await retryConflict(async () => {
      const row = await getRecords().get<EventState>("WEBHOOK", id);
      if (row)
        await getRecords().transaction([
          change("WEBHOOK", id, row, { ...row.value, done: true, until: 0 }),
        ]);
    });
    return Response.json({ received: true });
  } catch {
    const row = await getRecords().get<EventState>("WEBHOOK", id);
    if (row)
      await getRecords()
        .transaction([change("WEBHOOK", id, row, { ...row.value, until: 0 })])
        .catch(() => undefined);
    console.warn(JSON.stringify({ event: "payment.webhook_retry", eventId: id }));
    return Response.json({ error: "Event processing failed; retry required" }, { status: 503 });
  }
}
