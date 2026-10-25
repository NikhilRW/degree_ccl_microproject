import type { Address, DeliveryMethod, Order } from "@/types";

export interface CreateOrderInput {
  address: Address;
  delivery: DeliveryMethod;
  method: "cod";
  idempotencyKey: string;
  expectedTotal: number;
}

export interface OrderService {
  list(): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  cancel(id: string): Promise<Order>;
}
