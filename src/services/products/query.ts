import type { Product, ProductQuery } from "@/types";

export function applyProductQuery(list: Product[], query: ProductQuery = {}): Product[] {
  let result = list.filter((product) => !product.archived);
  if (query.search?.trim()) {
    const term = query.search.trim().toLowerCase();
    result = result.filter((product) =>
      [product.name, product.category, product.description, ...product.tags]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }
  if (query.categories?.length)
    result = result.filter((product) => query.categories!.includes(product.categoryId));
  if (query.minPrice !== undefined)
    result = result.filter((product) => product.price >= query.minPrice!);
  if (query.maxPrice !== undefined)
    result = result.filter((product) => product.price <= query.maxPrice!);
  if (query.minRating !== undefined)
    result = result.filter((product) => product.rating >= query.minRating!);
  switch (query.sort) {
    case "price-asc":
      return result.sort((a, b) => a.price - b.price);
    case "price-desc":
      return result.sort((a, b) => b.price - a.price);
    case "rating":
      return result.sort((a, b) => b.rating - a.rating);
    case "newest":
      return result.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    default:
      return result.sort((a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating);
  }
}
