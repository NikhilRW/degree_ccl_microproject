import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CategoryCard } from "@/components/product/CategoryCard";
import { LoadingState } from "@/components/common/states";
import { productService } from "@/services";
import type { Category } from "@/types";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "All categories — IntelliMart" },
      { name: "description", content: "Browse IntelliMart departments: electronics, computing, home, fashion, gaming, books and smart devices." },
      { property: "og:title", content: "All categories — IntelliMart" },
      { property: "og:description", content: "Eight departments, one curated catalogue." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  useEffect(() => {
    productService.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Categories</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Every department is curated by hand. Pick a lane and start browsing.
      </p>
      {!categories ? (
        <LoadingState label="Loading categories" />
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      )}
    </div>
  );
}
