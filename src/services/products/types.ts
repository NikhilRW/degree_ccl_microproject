import type { Category, Product, ProductQuery, Review } from "@/types";

export interface ProductService {
  list(query?: ProductQuery): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getFeatured(limit?: number): Promise<Product[]>;
  getRelated(id: string, limit?: number): Promise<Product[]>;
  getCategories(): Promise<Category[]>;
  getReviews(productId: string): Promise<Review[]>;
  getPriceRange(): Promise<{ min: number; max: number }>;
}
