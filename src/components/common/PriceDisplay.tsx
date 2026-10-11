import { cn } from "@/lib/utils";
import { currency, discountPercent } from "@/utils/format";

export function PriceDisplay({
  price,
  originalPrice,
  size = "md",
  className,
}: {
  price: number;
  originalPrice?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const pct = originalPrice ? discountPercent(price, originalPrice) : 0;
  const sizes = { sm: "text-sm", md: "text-lg", lg: "text-3xl" } as const;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span className={cn("font-display font-semibold tracking-tight", sizes[size])}>
        {currency(price)}
      </span>
      {pct > 0 && (
        <>
          <span className="text-sm text-muted-foreground line-through">
            {currency(originalPrice!)}
          </span>
          <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-semibold text-success">
            {pct}% off
          </span>
        </>
      )}
    </div>
  );
}
