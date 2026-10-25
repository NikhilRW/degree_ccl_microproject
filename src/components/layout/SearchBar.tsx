import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

export function SearchBar({
  className,
  initialValue = "",
  autoFocus = false,
}: {
  className?: string;
  initialValue?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState(initialValue);
  const navigate = useNavigate();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    void navigate({ to: "/search", search: { q } });
  };

  return (
    <form role="search" onSubmit={submit} className={cn("search-form", className)}>
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <Search className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Find your next favourite"
        autoFocus={autoFocus}
      />
    </form>
  );
}
