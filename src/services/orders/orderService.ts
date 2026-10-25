import { cancelMyOrder, getMyOrder, getMyOrders } from "@/server/orders.functions";
import type { OrderService } from "./types";

export const orderService: OrderService = {
  list: () => getMyOrders(),
  getById: (id) => getMyOrder({ data: id }),
  cancel: (id) => cancelMyOrder({ data: id }),
};
