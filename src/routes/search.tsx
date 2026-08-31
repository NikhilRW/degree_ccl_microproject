import { createFileRoute, Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/layout/SearchBar";
import { ProductGrid } from "@/components/product/ProductGrid";
import { EmptyState } from "@/components/common/states";
import { searchService } from "@/services";
import type { Product } from "@/types";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: ({ match }) => {
    const q = match.search.q;
    const title = q ? `Search results for "${q}" — IntelliMart` : "Search — IntelliMart";
    return {
      meta: [
        { title },
        { name: "description", content: q ? `Products matching "${q}" at IntelliMart.` : "Search the IntelliMart catalogue." },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: "Search the IntelliMart catalogue by name, category or description." },
      ],
    };
  },
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchService
      .search(q)
      .then((r) => !cancelled && setResults(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Search failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">
        {q ? <>Search results for &ldquo;{q}&rdquo;</> : "Search"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
        {loading ? "Searching…" : `${results.length} ${results.length === 1 ? "result" : "results"}`}
      </p>

      <div className="mt-6 max-w-md">
        <SearchBar initialValue={q} />
      </div>

      <div className="mt-10">
        {!loading && !error && results.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-5 w-5" aria-hidden />}
            title={`No matches for "${q}"`}
            description="Check the spelling, try a broader term, or browse the full catalogue."
            action={
              <Button asChild>
                <Link to="/shop">Browse all products</Link>
              </Button>
            }
          />
        ) : (
          <ProductGrid products={results} loading={loading} error={error} />
        )}
      </div>
    </div>
  );
}
