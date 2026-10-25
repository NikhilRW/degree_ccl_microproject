import { ProductCard } from "./ProductCard";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/states";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";

export function ProductGrid({
  products,
  loading,
  error,
  emptyTitle = "No products found",
  emptyDescription = "Try adjusting your filters or search for something else.",
  className,
}: {
  products: Product[];
  loading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} />;
  if (!products.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className={cn("product-grid", className)}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
