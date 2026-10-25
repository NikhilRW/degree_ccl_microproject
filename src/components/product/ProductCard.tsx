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
            className={cn("h-[18px] w-[18px]", saved && "fill-current")}
            strokeWidth={1.5}
            aria-hidden
          />
        </button>
      </div>
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
      </div>
    </article>
  );
}
