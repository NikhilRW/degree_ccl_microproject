import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

export function SearchBar({
  className,
  initialValue = "",
}: {
  className?: string;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const navigate = useNavigate();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    void navigate({ to: "/search", search: { q } });
  };

  return (
    <form role="search" onSubmit={submit} className={cn("relative w-full", className)}>
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        id="site-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search products, categories…"
        className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-smooth placeholder:text-muted-foreground focus:border-primary focus:bg-card"
      />
    </form>
  );
}
