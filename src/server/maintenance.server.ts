import type { Order } from "@/types";
import { change, getRecords } from "./records.server";
import { reconcileOrder } from "./orders.server";
import { queueOrderEmail, retryNotices } from "./notifications.server";

let running = false;
export async function runMaintenance() {
  if (running) return;
  running = true;
  try {
    for (const row of await getRecords().list<Order>("ORDER")) {
      try {
        if (row.value.status === "pending" || row.value.payment.status === "refund_pending")
          await reconcileOrder(row.id);
        if (
          ["processing", "shipped", "delivered"].includes(row.value.status) &&
          (row.value.payment.status === "captured" || row.value.payment.method === "cod")
        )
          await queueOrderEmail(row.value, "confirmation");
        if (["shipped", "delivered"].includes(row.value.status))
          await queueOrderEmail(row.value, "shipping");
      } catch {
        console.warn(JSON.stringify({ event: "order.reconciliation_failed", orderId: row.id }));
      }
    }
    await retryNotices();
    for (const kind of ["SESSION", "WEBHOOK", "MERGE"]) {
      let cursor = "";
      do {
        const page = await getRecords().page<{ expiresAt?: number }>(kind, cursor);
        for (const row of page.rows)
          if (row.value.expiresAt && row.value.expiresAt < Date.now()) {
            try {
              await getRecords().transaction([change(kind, row.id, row, null)]);
            } catch {
              /* Concurrent refresh/cleanup wins safely. */
            }
          }
        cursor = page.cursor;
      } while (cursor);
    }
  } finally {
    running = false;
  }
}

export function ensureMaintenanceTimer() {
  const state = globalThis as typeof globalThis & {
    __intellimartWorker?: { timer: ReturnType<typeof setInterval>; run: () => Promise<void> };
  };
  if (state.__intellimartWorker) {
    state.__intellimartWorker.run = runMaintenance;
    return;
  }
  const timer = setInterval(() => {
    void state
      .__intellimartWorker!.run()
      .catch(() => console.warn(JSON.stringify({ event: "maintenance.failed" })));
  }, 60000);
  timer.unref();
  state.__intellimartWorker = { timer, run: runMaintenance };
}
