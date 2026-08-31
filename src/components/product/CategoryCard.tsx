import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { Category } from "@/types";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      to="/shop"
      search={{ category: category.id }}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-card transition-smooth hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="aspect-4/3 overflow-hidden bg-surface">
        <img
          src={category.image}
          alt={category.name}
          loading="lazy"
          className="h-full w-full object-cover transition-smooth group-hover:scale-105"
        />
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">{category.name}</h3>
          <p className="text-xs text-muted-foreground">{category.productCount} products</p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-smooth group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
      </div>
    </Link>
  );
}
