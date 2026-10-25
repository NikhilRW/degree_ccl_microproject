import { createFileRoute } from "@tanstack/react-router";
import { awsServices } from "@/data/awsServices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/aws-learning")({
  head: () => ({
    meta: [
      { title: "AWS Implementation Lab — IntelliMart" },
      {
        name: "description",
        content:
          "IntelliMart's EC2-based AWS lab roadmap: TanStack server functions, Cognito, DynamoDB, S3, CloudFront, SES and CloudWatch.",
      },
      { property: "og:title", content: "AWS Implementation Lab — IntelliMart" },
      {
        property: "og:description",
        content: "Every mock service mapped to the AWS service that will replace it.",
      },
    ],
  }),
  component: AwsLearningPage,
});

function AwsLearningPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Implementation Lab
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold">AWS learning roadmap</h1>
        <p className="mt-4 text-muted-foreground">
          Customer and admin workflows now use TanStack server functions. Demo mode uses local data
          and simulated identity/payments; cloud mode uses Cognito, DynamoDB, S3, SES and Razorpay
          test APIs. Code-ready does not mean AWS resources are configured or the live deployment is
          verified.
        </p>
      </header>

      <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {awsServices.map((s) => (
          <li
            key={s.id}
            className="rounded-2xl border border-border bg-card p-6 transition-smooth hover:shadow-elevated"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">{s.name}</h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                  s.status === "implemented"
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {s.status.replace("-", " ")}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{s.purpose}</p>
            <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
              {s.tasks.map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-[11px] text-muted-foreground">{s.location}</p>
            <a
              href={s.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
            >
              AWS docs →
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
