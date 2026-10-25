import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceDisplay } from "@/components/common/PriceDisplay";
import { QuantitySelector } from "@/components/common/QuantitySelector";
import { RatingStars } from "@/components/common/RatingStars";
import { ErrorState, LoadingState } from "@/components/common/states";
import { ProductGrid } from "@/components/product/ProductGrid";
import { ProductReviewForm } from "@/components/product/ProductReviewForm";
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
      {
        name: "description",
        content: "Full specifications, reviews, shipping and returns for this IntelliMart product.",
      },
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
    setError(null);
    setImage(0);
    setQty(1);
    productService
      .getById(id)
      .then(async (p) => {
        if (cancelled) return;
        if (p) {
          const [related, reviews] = await Promise.all([productService.getRelated(p.id, 4), productService.getReviews(p.id)]);
          if (cancelled) return;
          setRelated(related);
          setReviews(reviews);
        }
        if (!cancelled) setProduct(p);
      })
      .catch(
        (e: unknown) =>
          !cancelled && setError(e instanceof Error ? e.message : "Failed to load product"),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingState label="Loading product" />;
  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState message={error} />
      </div>
    );
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
    if (!(await add(product.id, qty))) return;
    setDrawerOpen(false);
    void navigate({ to: "/checkout" });
  };

  return (
    <div className="site-container pb-24 pt-8 sm:pt-12">
      <nav aria-label="Breadcrumb" className="mb-8 text-[14px] text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Home
        </Link>{" "}
        <span aria-hidden>/</span>{" "}
        <Link to="/shop" className="hover:text-primary">
          Shop
        </Link>{" "}
        <span aria-hidden>/</span> <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <div className="overflow-clip bg-surface">
            <img
              src={product.images[image]}
              alt={product.name}
              width={1200}
              height={1200}
              className="aspect-square w-full object-cover"
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
                  "h-20 w-20 overflow-hidden transition-smooth",
                  i === image
                    ? "outline-2 outline-offset-4 outline-primary"
                    : "opacity-65 hover:opacity-100",
                )}
              >
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <h1 className="font-display text-[32px] font-medium leading-[1.1] sm:text-5xl">
            {product.name.replace("Wireless Noise Cancelling", "Noise-cancelling")}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">{product.category}</p>
          <div className="mt-3">
            <RatingStars rating={product.rating} reviewCount={product.reviewCount} size="md" />
          </div>
          <div className="mt-5">
            <PriceDisplay price={product.price} originalPrice={product.originalPrice} size="lg" />
          </div>
          <p
            className={cn(
              "mt-3 text-sm font-medium",
              outOfStock
                ? "text-destructive"
                : product.stock <= 10
                  ? "text-warning"
                  : "text-success",
            )}
          >
            {stockLabel(product.stock)}
          </p>

          <ul className="mt-6 space-y-2 text-base">
            {product.highlights.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <QuantitySelector value={qty} max={Math.max(product.stock, 1)} onChange={setQty} />
            <Button disabled={outOfStock} onClick={() => void add(product.id, qty)}>
              <ShoppingBag aria-hidden /> Add to bag
            </Button>
            <Button variant="outline" disabled={outOfStock} onClick={() => void buyNow()}>
              Buy now
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Toggle wishlist"
              aria-pressed={wishlist.has(product.id)}
              onClick={() => wishlist.toggle(product.id)}
            >
              <Heart
                className={cn(wishlist.has(product.id) && "fill-destructive text-destructive")}
                aria-hidden
              />
            </Button>
          </div>

          <div className="mt-10 space-y-5 bg-surface p-6">
            {[
              { title: "Shipping", body: "Free standard shipping over ₹20,000." },
              { title: "Delivery options", body: "Choose standard or express at checkout." },
            ].map((b) => (
              <div key={b.title}>
                <h2 className="text-base font-medium">{b.title}</h2>
                <p className="mt-1 text-sm">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="description" className="mt-16">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="specifications">Specifications</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>
        <TabsContent value="description" className="max-w-3xl pt-6 text-base leading-relaxed">
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
          <ProductReviewForm productId={product.id} onSubmitted={({ review, rating, reviewCount }) => {
            setReviews(current => [review, ...current.filter(item => item.id !== review.id)]);
            setProduct(current => current?.id === review.productId ? { ...current, rating, reviewCount } : current);
          }} />
          {!reviews.length && <p className="mb-5 text-sm text-muted-foreground">No reviews yet.</p>}
          <ul className="max-w-3xl space-y-5">
            {reviews.map((r) => (
              <li key={r.id} className="bg-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{r.author}</p>
                  <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                </div>
                <div className="mt-2">
                  <RatingStars rating={r.rating} />
                  {r.verifiedPurchase === true && <p className="mt-2 text-xs text-muted-foreground">Verified purchase</p>}
                </div>
                <h3 className="mt-3 text-sm font-semibold">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <section className="mt-24">
        <h2 className="font-display text-3xl font-medium sm:text-4xl">You might also like</h2>
        <div className="mt-10">
          <ProductGrid products={related} />
        </div>
      </section>
    </div>
  );
}
