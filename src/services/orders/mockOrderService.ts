import type { Order } from "@/types";
import { orders as seedOrders } from "@/data/orders";
import { cartService } from "../cart";
import { delay, readLocal, writeLocal } from "../serviceUtils";
import type { OrderService } from "./types";

const KEY = "intellimart.orders";

function all(): Order[] { return [...readLocal<Order[]>(KEY, []), ...seedOrders]; }

/**
 * AWS LEARNING ZONE:
 * Later this becomes AwsOrderService -> API Gateway -> Lambda:
 *   createOrder / getOrder / updateOrder / deleteOrder
 * Order writes should emit an EventBridge `OrderCreated` event, which fans out
 * to SQS -> Lambda for email (SES), inventory and analytics.
 */
export const mockOrderService: OrderService = {
  async list(userId) {
    await delay();
    return all().filter((o) => o.userId === userId || o.userId === "u_demo_001");
  },
  async getById(id) { await delay(150); return all().find((o) => o.id === id) ?? null; },
  async create({ cart, address, delivery, payment, userId }) {
    await delay(500);
    const totals = cartService.calculateTotals(cart, delivery);
    const now = new Date();
    const eta = new Date(now.getTime() + (delivery === "express" ? 2 : 6) * 864e5);
    const order: Order = {
      id: `IM-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 89999)}`,
      userId,
      items: cart.items
        .filter((i) => !i.savedForLater)
        .map((i) => ({ productId: i.productId, name: i.product.name, image: i.product.images[0]!, price: i.product.price, quantity: i.quantity })),
      totals,
      address,
      delivery,
      payment: { ...payment, amount: totals.total },
      status: "processing",
      createdAt: now.toISOString(),
      estimatedDelivery: eta.toISOString(),
    };
    writeLocal(KEY, [order, ...readLocal<Order[]>(KEY, [])]);
    return order;
  },
  async cancel(id) {
    await delay();
    const stored = readLocal<Order[]>(KEY, []).map((o) => (o.id === id ? { ...o, status: "cancelled" as const } : o));
    writeLocal(KEY, stored);
    const found = all().find((o) => o.id === id);
    if (!found) throw new Error("Order not found");
    return { ...found, status: "cancelled" };
  },
};

export const orderService: OrderService = mockOrderService;
