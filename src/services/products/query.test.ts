import { describe, expect, it } from "vitest";
import { products } from "@/data/products";
import { applyProductQuery } from "./query";

describe("catalogue queries", () => {
  it("does not mutate the seed catalogue", () => {
    const ids = products.map((product) => product.id);
    applyProductQuery(products, { sort: "price-asc" });
    expect(products.map((product) => product.id)).toEqual(ids);
  });
  it("hides archived products and filters case-insensitively", () => {
    const first = products[0]!;
    expect(applyProductQuery([{ ...first, archived: true }])).toEqual([]);
    expect(applyProductQuery([first], { search: first.name.toUpperCase() })).toHaveLength(1);
  });
  it("combines category, price and rating filters", () => {
    expect(
      applyProductQuery(products, {
        categories: ["gaming"],
        minPrice: 1000,
        maxPrice: 20000,
        minRating: 4,
      }).every(
        (product) =>
          product.categoryId === "gaming" &&
          product.price >= 1000 &&
          product.price <= 20000 &&
          product.rating >= 4,
      ),
    ).toBe(true);
  });
});
