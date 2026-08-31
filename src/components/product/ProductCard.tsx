import { Link } from "@tanstack/react-router";
import { Heart, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/common/PriceDisplay";
import { RatingStars } from "@/components/common/RatingStars";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { discountPercent, stockLabel } from "@/utils/format";

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { add } = useCart();
  const wishlist = useWishlist();
  const saved = wishlist.has(product.id);
  const pct = discountPercent(product.price, product.originalPrice);
  const outOfStock = product.stock === 0;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-smooth hover:-translate-y-1 hover:shadow-lift",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-surface">
        <Link to="/product/$id" params={{ id: product.id }} aria-label={product.name}>
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-smooth group-hover:scale-105"
          />
        </Link>
        {pct > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-ink-foreground">
            -{pct}%
          </span>
        )}
        <button
          type="button"
          onClick={() => wishlist.toggle(product.id)}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={saved}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-muted-foreground shadow-soft backdrop-blur transition-smooth hover:text-destructive"
        >
          <Heart className={cn("h-4 w-4", saved && "fill-destructive text-destructive")} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{product.category}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          <Link to="/product/$id" params={{ id: product.id }} className="transition-smooth hover:text-primary">
            {product.name}
          </Link>
        </h3>
        <RatingStars rating={product.rating} reviewCount={product.reviewCount} />
        <PriceDisplay price={product.price} originalPrice={product.originalPrice} />
        <p className={cn("text-xs font-medium", outOfStock ? "text-destructive" : product.stock <= 10 ? "text-warning" : "text-success")}>
          {stockLabel(product.stock)}
        </p>
        <Button
          className="mt-auto w-full"
          size="sm"
          disabled={outOfStock}
          onClick={() => void add(product.id)}
        >
          <ShoppingBag aria-hidden />
          {outOfStock ? "Out of stock" : "Add to cart"}
        </Button>
      </div>
    </article>
  );
}
