import type { Order } from "@/types";
import { products } from "./products";
import { demoUser } from "./users";

const line = (id: string, qty: number) => {
  const p = products.find((x) => x.id === id)!;
  return { productId: p.id, name: p.name, image: p.images[0]!, price: p.price, quantity: qty };
};

const totals = (subtotal: number) => ({
  subtotal,
  discount: Math.round(subtotal * 0.05),
  shipping: subtotal > 20000 ? 0 : 199,
  tax: Math.round(subtotal * 0.18),
  total: Math.round(subtotal * 1.13) + (subtotal > 20000 ? 0 : 199),
});

/** Sample demo-only orders. Cloud seed tooling does not create these records. */
export const orders: Order[] = [
  {
    id: "IM-2026-10428",
    userId: demoUser.id,
    items: [line("p01", 1), line("p09", 1)],
    totals: totals(29298),
    address: demoUser.addresses[0]!,
    delivery: "express",
    payment: { id: "pay_1", method: "card", last4: "4242", status: "captured", amount: 33107 },
    status: "delivered",
    createdAt: "2026-06-11T09:24:00.000Z",
    estimatedDelivery: "2026-06-14T09:24:00.000Z",
  },
  {
    id: "IM-2026-10913",
    userId: demoUser.id,
    items: [line("p04", 1)],
    totals: totals(32999),
    address: demoUser.addresses[0]!,
    delivery: "standard",
    payment: { id: "pay_2", method: "upi", status: "captured", amount: 37289 },
    status: "shipped",
    createdAt: "2026-08-02T15:10:00.000Z",
    estimatedDelivery: "2026-08-19T15:10:00.000Z",
  },
  {
    id: "IM-2026-11007",
    userId: demoUser.id,
    items: [line("p10", 2), line("p11", 1)],
    totals: totals(18997),
    address: demoUser.addresses[0]!,
    delivery: "standard",
    payment: { id: "pay_3", method: "cod", status: "pending", amount: 21665 },
    status: "processing",
    createdAt: "2026-08-14T11:02:00.000Z",
    estimatedDelivery: "2026-08-21T11:02:00.000Z",
  },
];
