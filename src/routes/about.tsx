import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
<<<<<<< HEAD
      { title: "About IntelliMart — Smarter Finds for Everyday Life" },
      {
        name: "description",
        content:
          "Get to know IntelliMart, your place to explore electronics, computing gear and smart devices for work, play and everyday life.",
=======
      { title: "About IntelliMart — Shop Smart. Learn AWS." },
      {
        name: "description",
        content:
          "IntelliMart is a real storefront experience built as a step-by-step AWS cloud engineering project.",
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
      },
      { property: "og:title", content: "About IntelliMart" },
      {
        property: "og:description",
<<<<<<< HEAD
        content: "Discover everyday upgrades in audio, computing, gaming and smart home gear.",
=======
        content: "A cloud computing lab storefront growing into an EC2-hosted AWS application.",
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
<<<<<<< HEAD
    <div className="site-container grid gap-12 pb-24 pt-10 sm:pt-16 lg:grid-cols-2 lg:gap-20">
      <div>
        <h1 className="font-display text-5xl font-medium leading-[1.05] sm:text-7xl">
          Good things.
          <br />
          Every day.
        </h1>
        <div className="mt-8 max-w-lg space-y-5 text-base leading-relaxed">
          <p>
            IntelliMart brings together electronics, computing and smart devices for everyday work
            and play. From audio and gaming to smart home gear, explore the products that fit your
            routine.
          </p>
          <p>
            Find your next upgrade at your own pace. Browse by category, narrow your search by brand
            or budget, and explore product specifications and reviews before adding something to
            your cart.
          </p>
          <p>
            Spotted something you like? Save it to your wishlist for another look, or head to our
            deals page to discover discounted products. Your account keeps your profile, wishlist
            and order history together in one place.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Button asChild variant="hero">
            <Link to="/shop">Start shopping</Link>
          </Button>
          <Link to="/deals" className="text-link">
            Explore deals
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 self-start lg:pt-2">
        <img
          src="/images/watch.jpg"
          alt="A simple white watch for everyday wear"
          width={800}
          height={1000}
          className="aspect-[4/5] w-full object-cover"
        />
        <img
          src="/images/keyboard.jpg"
          alt="A compact keyboard for your desk"
          width={800}
          height={1000}
          className="mt-12 aspect-[4/5] w-full object-cover"
        />
        <img
          src="/images/backpack.jpg"
          alt="An everyday backpack"
          width={800}
          height={1000}
          loading="lazy"
          className="aspect-[4/5] w-full object-cover"
        />
        <img
          src="/images/speaker.jpg"
          alt="A speaker for your favourite listening spot"
          width={800}
          height={1000}
          loading="lazy"
          className="mt-12 aspect-[4/5] w-full object-cover"
        />
=======
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
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
      </div>
    </div>
  );
}
