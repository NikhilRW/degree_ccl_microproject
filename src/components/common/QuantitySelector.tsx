import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantitySelector({
  value,
  onChange,
  max = 99,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  max?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-flex items-center rounded-lg border border-border bg-card", className)}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground transition-smooth hover:bg-surface hover:text-foreground disabled:opacity-40"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span aria-live="polite" className="w-10 text-center text-sm font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-smooth hover:bg-surface hover:text-foreground disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
