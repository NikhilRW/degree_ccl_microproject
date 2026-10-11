import { getPublicCatalogue } from "@/server/catalogue.functions";
import { applyProductQuery } from "./query";
import type { ProductService } from "./types";

// Catalogue operations now cross a real TanStack server-function boundary.
// The server uses a persisted synthetic demo store until the AWS milestone.
export const productService: ProductService = {
  async list(query) {
    return applyProductQuery((await getPublicCatalogue()).products, query);
  },
  async getById(id) {
    return (
      (await getPublicCatalogue()).products.find(
        (product) => product.id === id || product.slug === id,
      ) ?? null
    );
  },
  async getFeatured(limit = 8) {
    return (await getPublicCatalogue()).products
      .filter((product) => product.featured)
      .slice(0, limit);
  },
  async getRelated(id, limit = 4) {
    const { products } = await getPublicCatalogue();
    const base = products.find((product) => product.id === id);
    if (!base) return [];
    return [
      ...products.filter((product) => product.categoryId === base.categoryId && product.id !== id),
      ...products.filter((product) => product.categoryId !== base.categoryId),
    ].slice(0, limit);
  },
  async getCategories() {
    return (await getPublicCatalogue()).categories;
  },
  async getReviews(id) {
    return (await getPublicCatalogue()).reviews.filter((review) => review.productId === id);
  },
  async getPriceRange() {
    const prices = (await getPublicCatalogue()).products.map((product) => product.price);
    return prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : { min: 0, max: 0 };
  },
};
