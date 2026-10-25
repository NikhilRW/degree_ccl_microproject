import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About IntelliMart — Smarter Finds for Everyday Life" },
      {
        name: "description",
        content:
          "Get to know IntelliMart, your place to explore electronics, computing gear and smart devices for work, play and everyday life.",
      },
      { property: "og:title", content: "About IntelliMart" },
      {
        property: "og:description",
        content: "Discover everyday upgrades in audio, computing, gaming and smart home gear.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
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
      </div>
    </div>
  );
}
