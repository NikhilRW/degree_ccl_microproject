import type { Product, ProductQuery } from "@/types";
import { products, reviews } from "@/data/products";
import { categories } from "@/data/categories";
import { delay } from "../serviceUtils";
import type { ProductService } from "./types";

function applyQuery(list: Product[], q: ProductQuery = {}): Product[] {
  let out = [...list];
  if (q.search?.trim()) {
    const term = q.search.trim().toLowerCase();
    out = out.filter((p) =>
      [p.name, p.category, p.description, ...p.tags].join(" ").toLowerCase().includes(term),
    );
  }
  if (q.categories?.length) out = out.filter((p) => q.categories!.includes(p.categoryId));
  if (q.minPrice !== undefined) out = out.filter((p) => p.price >= q.minPrice!);
  if (q.maxPrice !== undefined) out = out.filter((p) => p.price <= q.maxPrice!);
  if (q.minRating !== undefined) out = out.filter((p) => p.rating >= q.minRating!);

  switch (q.sort) {
    case "price-asc": out.sort((a, b) => a.price - b.price); break;
    case "price-desc": out.sort((a, b) => b.price - a.price); break;
    case "rating": out.sort((a, b) => b.rating - a.rating); break;
    case "newest": out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)); break;
    default: out.sort((a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating);
  }
  return out;
}

/**
 * AWS LEARNING ZONE:
 * Replace with AwsProductService -> apiClient -> API Gateway -> Lambda -> DynamoDB.
 * Full-text search should move to Amazon OpenSearch or a DynamoDB GSI.
 */
export const mockProductService: ProductService = {
  async list(query) { await delay(); return applyQuery(products, query); },
  async getById(id) {
    await delay(180);
    return products.find((p) => p.id === id || p.slug === id) ?? null;
  },
  async getFeatured(limit = 8) {
    await delay();
    return products.filter((p) => p.featured).slice(0, limit);
  },
  async getRelated(id, limit = 4) {
    await delay();
    const base = products.find((p) => p.id === id);
    if (!base) return [];
    const same = products.filter((p) => p.categoryId === base.categoryId && p.id !== base.id);
    const rest = products.filter((p) => p.categoryId !== base.categoryId && p.id !== base.id);
    return [...same, ...rest].slice(0, limit);
  },
  async getCategories() { await delay(120); return categories; },
  async getReviews(productId) { await delay(150); return reviews.filter((r) => r.productId === productId); },
  async getPriceRange() {
    const prices = products.map((p) => p.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  },
};

export const productService: ProductService = mockProductService;
