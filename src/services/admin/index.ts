import type { z } from "zod";
import { adminOrdersSchema, adminOrderStatusSchema, createProductSchema, productUploadSchema, updatePriceSchema } from "@/domain/contracts";
import { adminAccessFn, adminCreateProductFn, adminOrdersFn, adminOrderStatusFn, adminProductsFn, adminUpdatePriceFn, adminUploadFn } from "@/functions/admin.functions";
import { authGeneration, isCurrentAuthGeneration, ServiceError, unwrap } from "../rpc";

export const adminService = {
  access: () => unwrap(() => adminAccessFn()),
  list: () => unwrap(() => adminProductsFn()),
  listOrders: (data: z.infer<typeof adminOrdersSchema> = {}) => unwrap(() => adminOrdersFn({ data })),
  updateOrderStatus: (data: z.infer<typeof adminOrderStatusSchema>) => unwrap(() => adminOrderStatusFn({ data })),
  create: (data: z.infer<typeof createProductSchema>) => unwrap(() => adminCreateProductFn({ data })),
  updatePrice: (data: z.infer<typeof updatePriceSchema>) => unwrap(() => adminUpdatePriceFn({ data })),
  async uploadImage(file: File) {
    const generation = authGeneration();
    const data = productUploadSchema.parse({ contentType: file.type, size: file.size });
    const policy = await unwrap(() => adminUploadFn({ data }));
    const form = new FormData();
    for (const [name, value] of Object.entries(policy.fields)) form.append(name, value);
    form.append("file", file); // S3 requires the file field last.
    const response = await fetch(policy.url, { method: "POST", body: form, credentials: "omit" });
    if (!isCurrentAuthGeneration(generation)) throw new ServiceError("Your account changed during the upload.", 409, "AUTH_CHANGED");
    if (!response.ok) throw new Error(`Image upload failed (${response.status}). Select the image again to retry.`);
    return policy.key;
  },
};
