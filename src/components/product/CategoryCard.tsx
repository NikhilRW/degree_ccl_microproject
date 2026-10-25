import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { Category } from "@/types";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link to="/shop" search={{ category: category.id }} className="category-tile group block">
      <div className="aspect-[4/3] overflow-clip bg-surface">
        <img
          src={category.image}
          alt={category.name}
          loading="lazy"
          width={800}
          height={600}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex items-start justify-between gap-4 py-5">
        <div>
          <h3 className="text-xl font-medium">{category.name}</h3>
          <p className="mt-2 text-[14px]">{category.description}</p>
        </div>
        <ArrowUpRight
<<<<<<< HEAD
          className="mt-1 h-5 w-5 shrink-0 transition-smooth group-hover:-translate-y-1 group-hover:translate-x-1"
          strokeWidth={1.5}
=======
          className="h-4 w-4 text-muted-foreground transition-smooth group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
          aria-hidden
        />
      </div>
    </Link>
  );
}
