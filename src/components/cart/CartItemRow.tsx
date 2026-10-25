import { Link } from "@tanstack/react-router";
import { Bookmark, Trash2 } from "lucide-react";
import { QuantitySelector } from "@/components/common/QuantitySelector";
import { useCart } from "@/hooks/useCart";
import type { CartItem } from "@/types";
import { currency } from "@/utils/format";

export function CartItemRow({ item, compact = false }: { item: CartItem; compact?: boolean }) {
  const { update, remove, toggleSaveForLater } = useCart();

  return (
    <div className="flex gap-4 py-4">
      <Link
        to="/product/$id"
        params={{ id: item.productId }}
        className={
          compact
            ? "h-20 w-20 shrink-0 overflow-hidden bg-surface"
            : "h-24 w-24 shrink-0 overflow-hidden bg-surface sm:h-32 sm:w-32"
        }
      >
        <img
          src={item.product.images[0]}
          alt={item.product.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/product/$id"
              params={{ id: item.productId }}
              className="line-clamp-2 text-sm font-semibold hover:text-primary"
            >
              {item.product.name}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.product.category}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {currency(item.product.price * item.quantity)}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <QuantitySelector
            value={item.quantity}
            max={Math.max(item.product.stock, 1)}
            onChange={(q) => void update(item.productId, q)}
          />
          {!compact && (
            <button
              type="button"
              onClick={() => void toggleSaveForLater(item.productId)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:text-primary"
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden />
              {item.savedForLater ? "Move to cart" : "Save for later"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void remove(item.productId)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
