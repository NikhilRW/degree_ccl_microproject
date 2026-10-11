import type { Order } from "@/types";

export interface OrderService {
  list(userId: string): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  cancel(id: string): Promise<Order>;
}
