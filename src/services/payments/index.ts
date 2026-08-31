import type { Payment } from "@/types";

export interface PaymentIntentInput {
  amount: number;
  method: Payment["method"];
  cardLast4?: string;
}

export interface PaymentService {
  createPaymentIntent(input: PaymentIntentInput): Promise<Payment>;
  confirmPayment(paymentId: string): Promise<Payment>;
}

/**
 * PAYMENT SERVICE — AWS / PAYMENT PROVIDER INTEGRATION ZONE
 * ---------------------------------------------------------
 * No real gateway is connected. This mock always authorises.
 * When you integrate for real:
 *   - Create the intent inside a Lambda (secret keys never reach the browser)
 *   - Store the provider secret in AWS Secrets Manager / SSM Parameter Store
 *   - Receive provider webhooks on API Gateway, verify the signature, then
 *     publish a `PaymentCompleted` event to EventBridge.
 */
export const mockPaymentService: PaymentService = {
  async createPaymentIntent({ amount, method, cardLast4 }) {
    await new Promise((r) => setTimeout(r, 400));
    return { id: `pay_mock_${Date.now()}`, method, ...(cardLast4 ? { last4: cardLast4 } : {}), status: "authorized", amount };
  },
  async confirmPayment(paymentId) {
    await new Promise((r) => setTimeout(r, 400));
    return { id: paymentId, method: "card", status: "captured", amount: 0 };
  },
};

export const paymentService: PaymentService = mockPaymentService;
