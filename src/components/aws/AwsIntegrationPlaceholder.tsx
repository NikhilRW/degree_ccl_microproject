import { CloudCog } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Learning marker: implementation and verified AWS deployment are distinct.
 */
export function AwsIntegrationPlaceholder({
  service,
  objective,
  location,
  className,
  compact = false,
}: {
  service: string;
  objective: string;
  location?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed border-primary/35 bg-primary/[0.04] p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CloudCog className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            AWS Integration Zone
          </p>
          {!compact && (
            <p className="mt-1 text-sm text-muted-foreground">
              Cloud adapters require configured AWS resources. Demo mode uses local data or
              simulation; verify cloud behavior after setup.
            </p>
          )}
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-muted-foreground/80">
                Target service
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">{service}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-muted-foreground/80">
                Learning objective
              </dt>
              <dd className="mt-0.5 text-foreground">{objective}</dd>
            </div>
            {location && (
              <div className="sm:col-span-2">
                <dt className="font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Integration location
                </dt>
                <dd className="mt-0.5 font-mono text-[11px] text-foreground">{location}</dd>
              </div>
            )}
          </dl>
          <Link
            to="/aws-learning"
            className="mt-3 inline-block text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open the AWS Implementation Lab →
          </Link>
        </div>
      </div>
    </aside>
  );
}
