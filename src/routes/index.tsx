import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/components/product/ProductGrid";
import { EmptyState, ErrorState } from "@/components/common/states";
import { productService } from "@/services";
import { currency } from "@/utils/format";
import type { Category, Product } from "@/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IntelliMart — Good Things for Your Everyday" },
      {
        name: "description",
        content:
          "A considered collection of electronics, desk essentials and everyday finds. Shop for the way you work, play and live.",
      },
      { property: "og:title", content: "IntelliMart — Good Things for Your Everyday" },
      {
        property: "og:description",
        content:
          "Electronics, desk essentials and everyday finds. Find something good at IntelliMart.",
      },
    ],
  }),
  component: HomePage,
});

const edits = [
  {
    id: "desk",
    label: "For your desk",
    description: "A better setup, one good find at a time.",
    categories: ["computing", "gaming", "accessories"],
  },
  {
    id: "move",
    label: "On the move",
    description: "A little company for the everyday journey.",
    categories: ["electronics", "smart", "accessories", "fashion"],
  },
  {
    id: "home",
    label: "At home",
    description: "Small upgrades for your favourite place.",
    categories: ["home", "smart", "books"],
  },
] as const;

function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editIndex, setEditIndex] = useState(0);
  const edit = edits[editIndex] ?? edits[0];

  useEffect(() => {
    let cancelled = false;
    Promise.all([productService.list(), productService.getCategories()])
      .then(([items, departments]) => {
        if (!cancelled) {
          setProducts(items);
          setCategories(departments);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the collection");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const picks = products
    .filter((product) => (edit.categories as readonly string[]).includes(product.categoryId))
    .slice(0, 4);
  const spotlight = products.find((product) => product.featured) ?? products[0];

  return (
    <>
      <section className="retail-hero" aria-labelledby="storefront-title">
        <div className="hero-picture">
          <img
            src="/images/headphones-yellow.jpg"
            alt="Black over-ear headphones on a sun-yellow background"
            width={1600}
            height={1067}
            fetchPriority="high"
          />
        </div>
        <div className="site-container hero-layout">
          <div className="hero-copy">
            <h1 id="storefront-title">
              For your
              <br /> everyday.
            </h1>
            <p>Electronics, desk essentials and good finds for the way you work, play and live.</p>
            <Button asChild variant="ink" size="xl" className="hero-action">
              <Link to="/shop">
                Shop the collection <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
          <div className="hero-caption">
            <span>A little less searching. A little more finding.</span>
            <Link to="/shop">
              Explore the collection <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="shop-section site-container" aria-labelledby="edit-title">
        <div className="section-heading">
          <div>
            <h2 id="edit-title">A few good finds</h2>
            <p>{edit.description}</p>
          </div>
          <Link to="/shop" className="text-link">
            View the whole collection
          </Link>
        </div>
        <div className="edit-controls" role="group" aria-label="Shop by your everyday routine">
          {edits.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={editIndex === index}
              aria-controls="everyday-products"
              onClick={() => setEditIndex(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div id="everyday-products" aria-live="polite" aria-busy={loading}>
          <ProductGrid key={edit.id} products={picks} loading={loading} error={error} />
        </div>
      </section>

      <section className="departments shop-section" aria-labelledby="departments-title">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <h2 id="departments-title">Find your department</h2>
              <p>From a new setup to your next page-turner.</p>
            </div>
            <Link to="/categories" className="text-link">
              Explore departments
            </Link>
          </div>
          {error ? (
            <ErrorState message={error} />
          ) : !loading && !categories.length ? (
            <EmptyState
              title="Our collection is on its way"
              description="Check back soon for new products and departments."
            />
          ) : (
            <div className="department-list">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to="/shop"
                  search={{ category: category.id }}
                  className="department-row"
                >
                  <img src={category.image} alt="" width={88} height={88} loading="lazy" />
                  <div>
                    <h3>{category.name}</h3>
                    <p>{category.description}</p>
                  </div>
                  <ArrowUpRight className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {spotlight && (
        <section className="shop-section site-container" aria-labelledby="audio-title">
          <div className="audio-feature">
            <div className="audio-picture">
              <img
                src={spotlight.images[0]}
                alt={spotlight.name}
                width={1600}
                height={1067}
                loading="lazy"
              />
            </div>
            <div className="audio-copy">
              <h2 id="audio-title">Worth a closer look</h2>
              <p>{spotlight.name}</p>
              <dl className="audio-facts">
                {spotlight.highlights.slice(0, 2).map((highlight) => (
                  <div key={highlight}>
                    <dt>{highlight}</dt>
                  </div>
                ))}
              </dl>
              <div className="audio-price">
                {currency(spotlight.price)}
                {spotlight.originalPrice > spotlight.price && (
                  <del>{currency(spotlight.originalPrice)}</del>
                )}
              </div>
              <Button asChild variant="ink" size="xl">
                <Link to="/product/$id" params={{ id: spotlight.id }}>
                  Take a closer look
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
