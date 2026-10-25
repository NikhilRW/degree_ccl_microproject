import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <Link
      to="/"
      className={cn("brand-wordmark", onDark && "text-ink-foreground", className)}
      aria-label="IntelliMart home"
    >
      intellimart
    </Link>
  );
}
