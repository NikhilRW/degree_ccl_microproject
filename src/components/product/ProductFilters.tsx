import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { Category } from "@/types";
import { currency } from "@/utils/format";

export interface FilterState {
  categories: string[];
  maxPrice: number;
  minRating: number;
}

export function ProductFilters({
  categories,
  state,
  onChange,
  priceRange,
  onReset,
}: {
  categories: Category[];
  state: FilterState;
  onChange: (next: FilterState) => void;
  priceRange: { min: number; max: number };
  onReset: () => void;
}) {
  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Category</legend>
        <div className="mt-4 space-y-3">
          {categories.map((c) => {
            const checked = state.categories.includes(c.id);
            return (
              <div key={c.id} className="flex items-center gap-2.5">
                <Checkbox
                  id={`cat-${c.id}`}
                  checked={checked}
                  onCheckedChange={() =>
                    onChange({
                      ...state,
                      categories: checked ? state.categories.filter((x) => x !== c.id) : [...state.categories, c.id],
                    })
                  }
                />
                <Label htmlFor={`cat-${c.id}`} className="cursor-pointer text-sm font-normal">
                  {c.name}
                </Label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Max price</legend>
        <div className="mt-5 px-1">
          <Slider
            value={[state.maxPrice]}
            min={priceRange.min}
            max={priceRange.max}
            step={500}
            onValueChange={([v]) => onChange({ ...state, maxPrice: v ?? priceRange.max })}
            aria-label="Maximum price"
          />
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>{currency(priceRange.min)}</span>
            <span className="font-semibold text-foreground">{currency(state.maxPrice)}</span>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Rating</legend>
        <div className="mt-4 space-y-3">
          {[0, 4, 4.5].map((r) => (
            <div key={r} className="flex items-center gap-2.5">
              <input
                type="radio"
                id={`rating-${r}`}
                name="rating"
                checked={state.minRating === r}
                onChange={() => onChange({ ...state, minRating: r })}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              <Label htmlFor={`rating-${r}`} className="cursor-pointer text-sm font-normal">
                {r === 0 ? "Any rating" : `${r}★ and above`}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>

      <Button variant="subtle" className="w-full" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}
