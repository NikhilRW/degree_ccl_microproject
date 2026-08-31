import { createFileRoute } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ProductFilters, type FilterState } from "@/components/product/ProductFilters";
import { ProductGrid } from "@/components/product/ProductGrid";
import { SearchBar } from "@/components/layout/SearchBar";
import { productService } from "@/services";
import type { Category, Product, ProductQuery } from "@/types";

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): { category?: string; sale?: boolean } => ({
    ...(typeof search["category"] === "string" ? { category: search["category"] } : {}),
    ...(search["sale"] === true || search["sale"] === "true" ? { sale: true } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Shop all products — IntelliMart" },
      {
        name: "description",
        content: "Filter and sort the full IntelliMart catalogue: electronics, computing, gaming, smart devices and more.",
      },
      { property: "og:title", content: "Shop all products — IntelliMart" },
      { property: "og:description", content: "Filter by category, price and rating across the full catalogue." },
    ],
  }),
  component: ShopPage,
});

const PRICE_MAX = 80000;

function ShopPage() {
  const { category, sale } = Route.useSearch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<NonNullable<ProductQuery["sort"]>>("featured");
  const [filters, setFilters] = useState<FilterState>({
    categories: category ? [category] : [],
    maxPrice: PRICE_MAX,
    minRating: 0,
  });

  useEffect(() => {
    setFilters((f) => ({ ...f, categories: category ? [category] : [] }));
  }, [category]);

  useEffect(() => {
    productService.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    productService
      .list({ categories: filters.categories, maxPrice: filters.maxPrice, minRating: filters.minRating, sort })
      .then((list) => !cancelled && setProducts(sale ? list.filter((p) => p.originalPrice > p.price) : list))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load products"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, sort, sale]);

  const reset = () => setFilters({ categories: [], maxPrice: PRICE_MAX, minRating: 0 });

  const filterPanel = useMemo(
    () => (
      <ProductFilters
        categories={categories}
        state={filters}
        onChange={setFilters}
        priceRange={{ min: 1000, max: PRICE_MAX }}
        onReset={reset}
      />
    ),
    [categories, filters],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{sale ? "Deals" : "Shop"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sale ? "Everything currently marked down." : "The full IntelliMart catalogue."}
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">{filterPanel}</div>
        </aside>

        <div>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="min-w-52 flex-1">
              <SearchBar />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="lg:hidden">
                  <SlidersHorizontal aria-hidden /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="font-display">Filters</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-8">{filterPanel}</div>
              </SheetContent>
            </Sheet>

            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="w-48" aria-label="Sort products">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {loading ? "Loading products…" : `${products.length} products`}
          </p>

          <ProductGrid products={products} loading={loading} error={error} />
        </div>
      </div>
    </div>
  );
}
