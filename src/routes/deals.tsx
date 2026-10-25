import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/product/ProductGrid";
import { productService } from "@/services";
import type { Product } from "@/types";
import { discountPercent } from "@/utils/format";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Today's deals — IntelliMart" },
      {
        name: "description",
        content:
          "Live markdowns across headphones, monitors, gaming gear and smart devices at IntelliMart.",
      },
      { property: "og:title", content: "Today's deals — IntelliMart" },
      {
        property: "og:description",
        content: "Every product currently marked down, sorted by biggest saving.",
      },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productService
      .list()
      .then((list) =>
        setProducts(
          list
            .filter((p) => p.originalPrice > p.price)
            .sort(
              (a, b) =>
                discountPercent(b.price, b.originalPrice) -
                discountPercent(a.price, a.originalPrice),
            ),
        ),
      )
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load deals"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <section className="bg-ink text-ink-foreground">
        <div className="site-container flex flex-wrap items-end justify-between gap-8 py-16 sm:py-20">
          <div>
<<<<<<< HEAD
            <h1 className="font-display text-5xl font-medium sm:text-7xl">The good deals</h1>
            <p className="mt-5 max-w-lg text-base">
              Good finds. Even better prices. Biggest savings first.
=======
            <p className="inline-flex items-center gap-2 rounded-full bg-highlight/15 px-3 py-1 text-xs font-semibold text-highlight">
              <Flame className="h-3.5 w-3.5" aria-hidden /> Live markdowns
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">
              Deals worth the upgrade
            </h1>
            <p className="mt-2 max-w-lg text-sm text-ink-foreground/70">
              Sorted by biggest saving. Prices refresh as stock moves.
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
            </p>
          </div>
          <Button asChild variant="onDark" size="xl">
            <Link to="/shop">Browse everything</Link>
          </Button>
        </div>
      </section>

<<<<<<< HEAD
      <div className="site-container py-16 sm:py-20">
=======
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
        <ProductGrid
          products={products}
          loading={loading}
          error={error}
          emptyTitle="No active deals right now"
        />
      </div>
    </div>
  );
}
