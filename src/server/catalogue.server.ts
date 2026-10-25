import "@tanstack/react-start/server-only";
import type { Category, Product, Review } from "../types";
import type { z } from "zod";
import type { productQuerySchema } from "../domain/contracts";
import { HttpError, imageUrl, presentProduct, product, queryItems } from "./aws.server";

export async function categories() {
  return Promise.all(
    (await queryItems<{ data: Category }>("CATALOG", "CATEGORY#")).map(async (item) => ({
      ...item.data,
      image: await imageUrl(item.data.image),
    })),
  );
}
async function catalogue() {
  return (await queryItems<{ data: Product }>("CATALOG", "PRODUCT#")).map((item) => item.data);
}
export async function detail(id: string) {
  try {
    return await presentProduct(await product(id));
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
export async function reviews(id: string) {
  await product(id);
  return (await queryItems<{ data: Review }>(`PRODUCT#${id}`, "REVIEW#")).map((item) => item.data);
}
export async function related(id: string, limit: number) {
  const p = await product(id);
  return Promise.all(
    (await catalogue())
      .filter((item) => item.id !== id)
      .sort((a, b) => Number(b.categoryId === p.categoryId) - Number(a.categoryId === p.categoryId))
      .slice(0, limit)
      .map(presentProduct),
  );
}
export async function priceRange() {
  const products = await catalogue();
  return {
    min: products.length ? Math.min(...products.map((p) => p.price)) : 0,
    max: products.length ? Math.max(...products.map((p) => p.price)) : 0,
  };
}
export async function list(query: z.infer<typeof productQuerySchema>) {
  let products = await catalogue();
  const term = query.search?.trim().toLowerCase();
  if (term)
    products = products.filter((p) =>
      [p.name, p.category, p.description, ...p.tags].join(" ").toLowerCase().includes(term),
    );
  if (query.categories?.length)
    products = products.filter((p) => query.categories!.includes(p.categoryId));
  if (query.minPrice !== undefined) products = products.filter((p) => p.price >= query.minPrice!);
  if (query.maxPrice !== undefined) products = products.filter((p) => p.price <= query.maxPrice!);
  if (query.minRating !== undefined)
    products = products.filter((p) => p.rating >= query.minRating!);
  if (query.featured) products = products.filter((p) => p.featured);
  switch (query.sort) {
    case "price-asc":
      products.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      products.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      products.sort((a, b) => b.rating - a.rating);
      break;
    case "newest":
      products.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      break;
    default:
      products.sort((a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating);
  }
  return Promise.all((query.limit ? products.slice(0, query.limit) : products).map(presentProduct));
}
export async function suggestions(term: string) {
  const query = term.trim().toLowerCase();
  return (await catalogue())
    .filter((p) =>
      [p.name, p.category, p.description, ...p.tags].join(" ").toLowerCase().includes(query),
    )
    .slice(0, 6)
    .map((p) => p.name);
}
