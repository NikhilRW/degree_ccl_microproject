import type { Address, DeliveryMethod, Order } from "@/types";

export interface CreateOrderInput {
  address: Address;
  delivery: DeliveryMethod;
  method: "card" | "upi" | "cod";
  idempotencyKey: string;
  expectedTotal: number;
}

export interface OrderService {
  list(): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  create(input: CreateOrderInput): Promise<Order>;
  cancel(id: string): Promise<Order>;
}
