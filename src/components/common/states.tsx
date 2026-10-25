import { AlertTriangle, PackageOpen, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LoadingSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("product-grid", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      ))}
      <span className="sr-only">Loading products</span>
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground"
      aria-live="polite"
    >
      <RefreshCw className="h-5 w-5 animate-spin" aria-hidden />
      <p className="text-sm">{label}…</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center bg-surface px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center text-foreground">
        {icon ?? <PackageOpen className="h-5 w-5" aria-hidden />}
      </div>
      <h3 className="text-2xl font-medium">{title}</h3>
      {description && <p className="mt-3 max-w-md text-base">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-16 text-center"
    >
      <AlertTriangle className="mb-4 h-6 w-6 text-destructive" aria-hidden />
      <h3 className="text-lg font-semibold">Something went wrong</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {message ?? "We couldn't complete that request. Please try again."}
      </p>
      {onRetry && (
        <Button className="mt-6" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
