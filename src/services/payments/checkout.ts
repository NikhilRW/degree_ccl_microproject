import { createCheckout, confirmCheckout, resumeMyCheckout } from "@/server/orders.functions";
import type { Address, DeliveryMethod, Order, Payment } from "@/types";

interface PaymentResponse {
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open(): void;
  close(): void;
  on(event: string, callback: () => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}
let scriptPromise: Promise<void> | undefined;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return (scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () =>
      window.Razorpay ? resolve() : reject(new Error("Payment checkout could not initialize"));
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error("Could not load Razorpay checkout"));
    };
    document.head.appendChild(script);
  }));
}
export async function payForCheckout(input: {
  address: Address;
  delivery: DeliveryMethod;
  method: Payment["method"];
  idempotencyKey: string;
}): Promise<Order> {
  const prepared = await createCheckout({ data: input });
  return payPrepared(prepared);
}

export async function payExistingOrder(id: string): Promise<Order> {
  return payPrepared(await resumeMyCheckout({ data: id }));
}

async function payPrepared(prepared: Awaited<ReturnType<typeof createCheckout>>): Promise<Order> {
  if (prepared.order.status !== "pending") return prepared.order;
  if (prepared.demo) {
    if (
      !window.confirm(
        `Simulate payment of INR ${prepared.order.totals.total.toFixed(2)}? No money is charged.`,
      )
    )
      throw new Error(
        "Payment dismissed. The pending order remains in your account until retry or cancellation.",
      );
    return confirmCheckout({
      data: { orderId: prepared.order.id, paymentId: "demo", signature: "demo" },
    });
  }
  await loadCheckout();
  return new Promise<Order>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: prepared.keyId,
      order_id: prepared.order.providerOrderId,
      amount: prepared.amount,
      currency: prepared.currency,
      name: "IntelliMart — Test checkout",
      description: prepared.order.id,
      prefill: { name: prepared.order.address.fullName, contact: prepared.order.address.phone },
      handler: (response: PaymentResponse) => {
        void confirmCheckout({
          data: {
            orderId: prepared.order.id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          },
        }).then(resolve, reject);
      },
      modal: {
        ondismiss: () =>
          reject(
            new Error(
              "Checkout dismissed. Check your pending order in your account before starting another payment.",
            ),
          ),
      },
    });
    checkout.on("payment.failed", () => {
      checkout.close();
      reject(new Error("Test payment failed. Retry this checkout or cancel it from your account."));
    });
    checkout.open();
  });
}
