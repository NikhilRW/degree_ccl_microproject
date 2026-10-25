import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CategoryCard } from "@/components/product/CategoryCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { productService } from "@/services";
import type { Category } from "@/types";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "All categories — IntelliMart" },
      {
        name: "description",
        content:
          "Browse IntelliMart departments: electronics, computing, home, fashion, gaming, books and smart devices.",
      },
      { property: "og:title", content: "All categories — IntelliMart" },
      { property: "og:description", content: "Eight departments, one curated catalogue." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    productService
      .getCategories()
      .then(setCategories)
      .catch((error: unknown) => {
        setError(error instanceof Error ? error.message : "Could not load departments.");
        setCategories([]);
      });
  }, []);

  return (
    <div className="site-container pb-24 pt-10 sm:pt-16">
      <h1 className="font-display text-5xl font-medium sm:text-7xl">Departments</h1>
      <p className="mt-5 max-w-xl text-base">
        Find your next good thing. Start with what you love.
      </p>
      {error ? (
        <div className="mt-12">
          <ErrorState message={error} />
        </div>
      ) : !categories ? (
        <LoadingState label="Loading categories" />
      ) : !categories.length ? (
        <div className="mt-12">
          <EmptyState
            title="No departments yet"
            description="Our collection will be available here soon."
          />
        </div>
      ) : (
        <div className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      )}
    </div>
  );
}
