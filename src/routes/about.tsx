import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AwsIntegrationPlaceholder } from "@/components/aws/AwsIntegrationPlaceholder";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About IntelliMart — Shop Smart. Learn AWS." },
      {
        name: "description",
        content:
          "IntelliMart is a real storefront experience built as a step-by-step AWS cloud engineering project.",
      },
      { property: "og:title", content: "About IntelliMart" },
      {
        property: "og:description",
        content: "A cloud computing lab storefront growing into an EC2-hosted AWS application.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">About</p>
      <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
        Shop Smart. Learn AWS. Build the Cloud.
      </h1>
      <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <p>
          IntelliMart is a marketplace for the things that make everyday work and play better —
          audio, computing, gaming and smart home gear, chosen for build quality rather than
          spec-sheet noise.
        </p>
        <p>
          It is also, deliberately, a cloud computing lab project. The storefront demonstrates
          catalogue, search, filters, cart, checkout, orders and account screens. What sits behind
          them is a service layer of clean interfaces —{" "}
          <code className="font-mono text-xs">AuthService</code>,{" "}
          <code className="font-mono text-xs">ProductService</code>,{" "}
          <code className="font-mono text-xs">OrderService</code> and friends. The catalogue now
          uses TanStack server functions with separate demo and cloud adapters. Customer accounts,
          persisted shopping data, test checkout, order administration, catalogue management and
          review moderation are implemented. Demo authentication is simulated; configured cloud mode
          verifies Cognito sessions and administrator permissions on the server.
        </p>
        <p>
          The planned deployment runs this complete TanStack Start application on EC2, with its own
          server functions as the backend. Cognito provides identity and admin permissions; DynamoDB
          stores application data; S3 and CloudFront deliver images and application content; SES
          sends test emails; Secrets Manager protects Razorpay test keys; IAM controls access; and
          CloudWatch supports monitoring. A separate API Gateway/Lambda backend is not required for
          this design.
        </p>
      </div>

      <AwsIntegrationPlaceholder
        className="mt-10"
        service="Full AWS architecture"
        objective="Configure AWS resources and environment identifiers, seed the catalogue, then verify the deployed cloud integrations."
        location="docs/AWS_SETUP.md"
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
