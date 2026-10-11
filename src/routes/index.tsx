import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CloudCog, Cpu, ShieldCheck, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import heroImage from "@/assets/hero-products.jpg";
import { Button } from "@/components/ui/button";
import { CategoryCard } from "@/components/product/CategoryCard";
import { ProductGrid } from "@/components/product/ProductGrid";
import { productService } from "@/services";
import type { Category, Product } from "@/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IntelliMart — Everything You Need. One Smarter Marketplace." },
      {
        name: "description",
        content:
          "Discover quality electronics, computing gear and smart devices at IntelliMart — great deals and a shopping experience built for the cloud.",
      },
      { property: "og:title", content: "IntelliMart — One Smarter Marketplace" },
      {
        property: "og:description",
        content: "Quality products, great deals, and a shopping experience built for the cloud.",
      },
    ],
  }),
  component: HomePage,
});

const promises = [
  { icon: Truck, title: "Free 2-day delivery", body: "On every order above ₹20,000, nationwide." },
  { icon: ShieldCheck, title: "2-year warranty", body: "Every product covered, no fine print." },
  { icon: Cpu, title: "Expert-picked gear", body: "Curated by people who actually use it." },
  {
    icon: CloudCog,
    title: "Built on the cloud",
    body: "An architecture designed to scale with you.",
  },
];

function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([productService.getFeatured(8), productService.getCategories()])
      .then(([p, c]) => {
        if (cancelled) return;
        setFeatured(p);
        setCategories(c);
      })
      .catch(
        (e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load"),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-gradient text-ink-foreground">
        <div className="absolute inset-0 grid-lines opacity-60" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-28">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full border border-ink-foreground/20 bg-ink-foreground/5 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-highlight" aria-hidden />
              Shop Smart. Learn AWS. Build the Cloud.
            </p>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] text-balance-tight sm:text-5xl lg:text-6xl">
              Everything You Need. One Smarter Marketplace.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-foreground/70">
              Discover quality products, great deals, and a shopping experience built for the cloud.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="xl" variant="hero">
                <Link to="/shop">
                  Shop Now <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="xl" variant="onDark">
                <Link to="/deals">Explore Deals</Link>
              </Button>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6">
              {[
                ["20+", "Curated products"],
                ["4.6★", "Average rating"],
                ["48h", "Typical delivery"],
              ].map(([k, v]) => (
                <div key={v}>
                  <dt className="font-display text-2xl font-semibold">{k}</dt>
                  <dd className="mt-1 text-xs text-ink-foreground/60">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative animate-soft-fade">
            <div className="absolute -inset-8 rounded-[3rem] bg-primary/20 blur-3xl" aria-hidden />
            <img
              src={heroImage}
              alt="A curated arrangement of headphones, a smartwatch, a camera and a portable SSD"
              width={1408}
              height={1200}
              className="relative rounded-3xl border border-ink-foreground/10 shadow-lift"
            />
          </div>
        </div>
      </section>

      {/* Promises */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {promises.map((p) => (
            <div key={p.title} className="flex gap-3">
              <p.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="text-sm font-semibold">{p.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Shop by category</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Eight departments, one obsessively curated catalogue.
            </p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/categories">
              All categories <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <CategoryCard key={c.id} category={c} />
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="bg-surface/50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">
                Featured this week
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Hand-picked upgrades our team is actually using.
              </p>
            </div>
            <Button asChild variant="ghost">
              <Link to="/shop">
                Browse all <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="mt-8">
            <ProductGrid products={featured} loading={loading} error={error} />
          </div>
        </div>
      </section>

      {/* Developer strip */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-ink px-6 py-12 text-ink-foreground sm:px-12">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div className="max-w-xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                For developers
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
                This storefront is a cloud engineering lab.
              </h2>
              <p className="mt-3 text-sm text-ink-foreground/70">
                Every backend concern — auth, catalogue, cart, orders, storage, payments,
                notifications — sits behind a mock service with a clean interface, waiting to be
                replaced with real AWS infrastructure.
              </p>
            </div>
            <Button asChild size="xl" variant="hero">
              <Link to="/aws-learning">
                Open the Implementation Lab <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
