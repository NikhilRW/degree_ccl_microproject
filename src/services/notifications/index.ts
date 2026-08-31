import type { Order, User } from "@/types";

export interface NotificationService {
  sendWelcomeEmail(user: User): Promise<void>;
  sendOrderConfirmation(order: Order, user: User): Promise<void>;
  sendShippingUpdate(order: Order, user: User): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
}

const log = (event: string, payload: unknown) =>
  console.info(`[AWS INTEGRATION PENDING] NotificationService.${event}`, payload);

/**
 * AWS LEARNING ZONE — Amazon SES (email) and Amazon SNS (SMS / pub-sub)
 * These calls should be made from Lambda, triggered by EventBridge/SQS events,
 * never from the browser. This mock exists so the UX flow is complete today.
 */
export const mockNotificationService: NotificationService = {
  async sendWelcomeEmail(user) { log("sendWelcomeEmail", user.email); },
  async sendOrderConfirmation(order, user) { log("sendOrderConfirmation", { order: order.id, to: user.email }); },
  async sendShippingUpdate(order, user) { log("sendShippingUpdate", { order: order.id, to: user.email }); },
  async sendPasswordReset(email) { log("sendPasswordReset", email); },
};

export const notificationService: NotificationService = mockNotificationService;
