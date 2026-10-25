import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { currency, discountPercent } from "@/utils/format";

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { add } = useCart();
  const wishlist = useWishlist();
  const [adding, setAdding] = useState(false);
  const saved = wishlist.has(product.id);
  const discount = discountPercent(product.price, product.originalPrice);
  const outOfStock = product.stock === 0;
  const name = product.name.replace("Wireless Noise Cancelling", "Noise-cancelling");

  const addToBag = async () => {
    setAdding(true);
    try {
      await add(product.id);
    } finally {
      setAdding(false);
    }
  };

  return (
    <article className={cn("product-card", className)}>
      <div className="product-picture">
        <Link to="/product/$id" params={{ id: product.id }} aria-label={`View ${product.name}`}>
          <img src={product.images[0]} alt={product.name} loading="lazy" width={800} height={800} />
        </Link>
        {discount > 0 && <span className="product-sale">Save {discount}%</span>}
        <button
          type="button"
          onClick={() => wishlist.toggle(product.id)}
          aria-label={
            saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`
          }
          aria-pressed={saved}
          className="save-product"
        >
          <Heart
<<<<<<< HEAD
            className={cn("h-[18px] w-[18px]", saved && "fill-current")}
            strokeWidth={1.5}
=======
            className={cn("h-4 w-4", saved && "fill-destructive text-destructive")}
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
            aria-hidden
          />
        </button>
      </div>
<<<<<<< HEAD
      <div className="product-info">
        <p className="product-category">{product.category}</p>
        <h3>
          <Link to="/product/$id" params={{ id: product.id }}>
            {name}
          </Link>
        </h3>
        <p className="product-detail">{product.highlights.slice(0, 2).join(" · ")}</p>
        <div className="product-buy">
          <div className="product-price">
            <span>{currency(product.price)}</span>
            {discount > 0 && <del>{currency(product.originalPrice)}</del>}
          </div>
          <button
            type="button"
            className="add-product"
            disabled={outOfStock || adding}
            onClick={() => void addToBag()}
            aria-label={`Add ${product.name} to bag`}
          >
            {outOfStock ? "Sold out" : adding ? "Adding…" : "Add to bag"}
          </button>
        </div>
=======

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {product.category}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          <Link
            to="/product/$id"
            params={{ id: product.id }}
            className="transition-smooth hover:text-primary"
          >
            {product.name}
          </Link>
        </h3>
        <RatingStars rating={product.rating} reviewCount={product.reviewCount} />
        <PriceDisplay price={product.price} originalPrice={product.originalPrice} />
        <p
          className={cn(
            "text-xs font-medium",
            outOfStock ? "text-destructive" : product.stock <= 10 ? "text-warning" : "text-success",
          )}
        >
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
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
      </div>
    </article>
  );
}
