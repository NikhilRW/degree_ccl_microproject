import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, ShieldCheck, ShoppingBag, Truck, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceDisplay } from "@/components/common/PriceDisplay";
import { QuantitySelector } from "@/components/common/QuantitySelector";
import { RatingStars } from "@/components/common/RatingStars";
import { ErrorState, LoadingState } from "@/components/common/states";
import { ProductGrid } from "@/components/product/ProductGrid";
import { AwsIntegrationPlaceholder } from "@/components/aws/AwsIntegrationPlaceholder";
import { productService } from "@/services";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import type { Product, Review } from "@/types";
import { cn } from "@/lib/utils";
import { formatDate, stockLabel } from "@/utils/format";

export const Route = createFileRoute("/product/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Product ${params.id} — IntelliMart` },
      { name: "description", content: "Full specifications, reviews, shipping and returns for this IntelliMart product." },
      { property: "og:title", content: "IntelliMart product" },
      { property: "og:description", content: "Specifications, reviews, shipping and returns." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { add, setDrawerOpen } = useCart();
  const wishlist = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [image, setImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setImage(0);
    setQty(1);
    productService
      .getById(id)
      .then(async (p) => {
        if (cancelled) return;
        setProduct(p);
        if (p) {
          setRelated(await productService.getRelated(p.id, 4));
          setReviews(await productService.getReviews(p.id));
        }
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load product"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingState label="Loading product" />;
  if (error) return <div className="mx-auto max-w-3xl px-4 py-16"><ErrorState message={error} /></div>;
  if (!product)
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Product not found</h1>
        <Button asChild className="mt-6">
          <Link to="/shop">Back to shop</Link>
        </Button>
      </div>
    );

  const outOfStock = product.stock === 0;

  const buyNow = async () => {
    await add(product.id, qty);
    setDrawerOpen(false);
    void navigate({ to: "/checkout" });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link> <span aria-hidden>/</span>{" "}
        <Link to="/shop" className="hover:text-primary">Shop</Link> <span aria-hidden>/</span>{" "}
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <img
              src={product.images[image]}
              alt={product.name}
              width={1200}
              height={1200}
              className="aspect-square w-full object-cover animate-soft-fade"
              key={image}
            />
          </div>
          <div className="mt-4 flex gap-3">
            {product.images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setImage(i)}
                aria-label={`View image ${i + 1}`}
                aria-current={i === image}
                className={cn(
                  "h-20 w-20 overflow-hidden rounded-xl border-2 transition-smooth",
                  i === image ? "border-primary" : "border-border hover:border-primary/50",
                )}
              >
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{product.category}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">{product.name}</h1>
          <div className="mt-3">
            <RatingStars rating={product.rating} reviewCount={product.reviewCount} size="md" />
          </div>
          <div className="mt-5">
            <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="lg" />
          </div>
          <p className={cn("mt-3 text-sm font-medium", outOfStock ? "text-destructive" : product.stock <= 10 ? "text-warning" : "text-success")}>
            {stockLabel(product.stock)}
          </p>

          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            {product.highlights.map((h) => (
              <li key={h} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                {h}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <QuantitySelector value={qty} max={Math.max(product.stock, 1)} onChange={setQty} />
            <Button disabled={outOfStock} onClick={() => void add(product.id, qty)}>
              <ShoppingBag aria-hidden /> Add to cart
            </Button>
            <Button variant="hero" disabled={outOfStock} onClick={() => void buyNow()}>
              Buy now
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Toggle wishlist"
              aria-pressed={wishlist.has(product.id)}
              onClick={() => wishlist.toggle(product.id)}
            >
              <Heart className={cn(wishlist.has(product.id) && "fill-destructive text-destructive")} aria-hidden />
            </Button>
          </div>

          <div className="mt-8 grid gap-4 rounded-2xl border border-border bg-surface/60 p-5 sm:grid-cols-3">
            {[
              { icon: Truck, title: "Shipping", body: "Free over ₹20,000. Express in 2 days." },
              { icon: Undo2, title: "Returns", body: "30-day no-questions returns." },
              { icon: ShieldCheck, title: "Warranty", body: "2 years, covered end to end." },
            ].map((b) => (
              <div key={b.title} className="flex gap-2.5">
                <b.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <h2 className="text-xs font-semibold">{b.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{b.body}</p>
                </div>
              </div>
            ))}
          </div>

          <AwsIntegrationPlaceholder
            className="mt-6"
            compact
            service="Amazon DynamoDB + API Gateway + Lambda"
            objective="Serve this product from a Products table instead of the mock catalogue."
            location="src/services/products/mockProductService.ts"
          />
        </div>
      </div>

      <Tabs defaultValue="description" className="mt-16">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="specifications">Specifications</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>
        <TabsContent value="description" className="max-w-3xl pt-6 text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </TabsContent>
        <TabsContent value="specifications" className="pt-6">
          <dl className="max-w-2xl divide-y divide-border rounded-xl border border-border">
            {Object.entries(product.specifications).map(([k, v]) => (
              <div key={k} className="grid grid-cols-2 gap-4 px-4 py-3 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>
        <TabsContent value="reviews" className="pt-6">
          <ul className="max-w-3xl space-y-5">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{r.author}</p>
                  <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                </div>
                <div className="mt-2">
                  <RatingStars rating={r.rating} />
                </div>
                <h3 className="mt-3 text-sm font-semibold">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">You may also like</h2>
        <div className="mt-6">
          <ProductGrid products={related} />
        </div>
      </section>
    </div>
  );
}
