import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="IntelliMart home">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gradient text-primary-foreground shadow-soft">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 17h11a4 4 0 0 0 .6-7.96A6 6 0 0 0 6 10.5a3.25 3.25 0 0 0 0 6.5Z" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={cn("font-display text-lg font-semibold tracking-tight", onDark && "text-ink-foreground")}>
        Intelli<span className="text-primary">Mart</span>
      </span>
    </Link>
  );
}
