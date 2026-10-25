import type { OrderService } from "./types";
import { cancelOrderFn, createOrderFn, orderFn, ordersFn } from "@/functions/customer.functions";
import { ServiceError, unwrap } from "../rpc";

export const orderService: OrderService = {
  list: () => unwrap(() => ordersFn()),
  async getById(id) {
    try { return await unwrap(() => orderFn({ data: id })); }
    catch (error) { if (error instanceof ServiceError && error.status === 404) return null; throw error; }
  },
  create: input => unwrap(() => createOrderFn({ data: input })),
  cancel: id => unwrap(() => cancelOrderFn({ data: id })),
};
