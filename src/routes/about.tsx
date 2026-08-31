import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AwsIntegrationPlaceholder } from "@/components/aws/AwsIntegrationPlaceholder";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About IntelliMart — Shop Smart. Learn AWS." },
      { name: "description", content: "IntelliMart is a real storefront experience built as a step-by-step AWS cloud engineering project." },
      { property: "og:title", content: "About IntelliMart" },
      { property: "og:description", content: "A production-grade storefront designed to grow into a full AWS architecture." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">About</p>
      <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Shop Smart. Learn AWS. Build the Cloud.</h1>
      <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <p>
          IntelliMart is a marketplace for the things that make everyday work and play better — audio, computing,
          gaming and smart home gear, chosen for build quality rather than spec-sheet noise.
        </p>
        <p>
          It is also, deliberately, an engineering project. The storefront you are browsing is complete: catalogue,
          search, filters, cart, checkout, orders and account management all work end to end. What sits behind them is
          a service layer of clean interfaces — <code className="font-mono text-xs">AuthService</code>,{" "}
          <code className="font-mono text-xs">ProductService</code>, <code className="font-mono text-xs">OrderService</code>{" "}
          and friends — each backed by a mock implementation today.
        </p>
        <p>
          One AWS service at a time, those mocks get replaced by real infrastructure: Cognito for identity, API Gateway
          and Lambda for business logic, DynamoDB for data, S3 and CloudFront for assets, SES and SNS for messaging,
          SQS and EventBridge for asynchronous work, CloudWatch and X-Ray for observability.
        </p>
      </div>

      <AwsIntegrationPlaceholder
        className="mt-10"
        service="Full AWS architecture"
        objective="Replace each mock service with its AWS counterpart, one at a time."
        location="src/services/*"
      />

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild variant="hero">
          <Link to="/shop">Start shopping</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/aws-learning">See the roadmap</Link>
        </Button>
      </div>
    </div>
  );
}
