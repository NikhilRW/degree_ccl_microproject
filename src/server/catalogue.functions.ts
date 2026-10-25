import { createServerFn } from "@tanstack/react-start";
import { archiveProductSchema, productEditSchema } from "@/services/admin/schema";
import { getCatalogueStore } from "./catalogue.server";
import { requireAdmin } from "./auth.server";

export const getPublicCatalogue = createServerFn({ method: "GET" }).handler(async () => {
  const { products, categories, reviews } = await getCatalogueStore().snapshot(false);
  const activeCategories = categories.filter((category) => !category.archived);
  const active = products.filter(
    (product) =>
      !product.archived && activeCategories.some((category) => category.id === product.categoryId),
  );
  return {
    products: active,
    categories: activeCategories,
    reviews: reviews.filter(
      (review) =>
        review.status === "approved" && active.some((product) => product.id === review.productId),
    ),
  };
});

export const getAdminCatalogue = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  return getCatalogueStore().snapshot();
});

export const saveAdminProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => productEditSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    return getCatalogueStore().upsert(data, actor.id);
  });

export const archiveAdminProduct = createServerFn({ method: "POST" })
  .validator((input: unknown) => archiveProductSchema.parse(input))
  .handler(async ({ data }) => {
    const actor = await requireAdmin();
    return getCatalogueStore().archive(data, actor.id);
  });
