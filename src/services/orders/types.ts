import type { Address, Cart, DeliveryMethod, Order, Payment } from "@/types";

export interface CreateOrderInput {
  cart: Cart;
  address: Address;
  delivery: DeliveryMethod;
  payment: Payment;
  userId: string;
}

export interface OrderService {
  list(userId: string): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  create(input: CreateOrderInput): Promise<Order>;
  cancel(id: string): Promise<Order>;
}
