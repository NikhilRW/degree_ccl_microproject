import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { reviewSchema } from "@/domain/contracts";
import { reviewService } from "@/services/reviews";
import { authGeneration, isCurrentAuthGeneration, ServiceError } from "@/services/rpc";
import type { Review, ReviewEligibility } from "@/types";

export function ProductReviewForm({ productId, onSubmitted }: {
  productId: string;
  onSubmitted: (result: { review: Review; rating: number; reviewCount: number }) => void;
}) {
  const { user, loading } = useAuth();
  // Key the private form by identity so drafts/eligibility cannot cross accounts.
  if (loading) return <p role="status" className="mb-6 text-sm">Checking sign-in…</p>;
  if (!user) return <p className="mb-6 bg-surface p-6 text-sm"><Link to="/login" className="underline underline-offset-4">Sign in</Link> to review a product you ordered and received.</p>;
  return <SignedInReviewForm key={`${user.id}:${productId}`} productId={productId} onSubmitted={onSubmitted} />;
}

function SignedInReviewForm({ productId, onSubmitted }: {
  productId: string;
  onSubmitted: (result: { review: Review; rating: number; reviewCount: number }) => void;
}) {
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    setEligibility(null); setError("");
    reviewService.eligibility(productId).then(value => { if (!cancelled) setEligibility(value); })
      .catch((error: unknown) => { if (!cancelled) setError(error instanceof Error ? error.message : "Could not check review eligibility."); });
    return () => { cancelled = true; };
  }, [productId, retry]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const parsed = reviewSchema.safeParse({ productId, rating: Number(rating), title: form.get("title"), body: form.get("body") });
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
    const generation = authGeneration(); setBusy(true);
    try {
      const result = await reviewService.submit(parsed.data);
      if (active.current && isCurrentAuthGeneration(generation)) {
        setEligibility({ canReview: false, reason: "You have already reviewed this product.", review: result.review });
        setSubmitted(true); onSubmitted(result);
      }
    } catch (error) {
      if (active.current && isCurrentAuthGeneration(generation)) {
        if (error instanceof ServiceError && error.code === "ALREADY_REVIEWED") setRetry(value => value + 1);
        else setError(error instanceof Error ? error.message : "Could not save your review.");
      }
    } finally { if (active.current && isCurrentAuthGeneration(generation)) setBusy(false); }
  };
  return <section className="mb-6 max-w-3xl bg-surface p-6" aria-labelledby="write-review">
    <h2 id="write-review" className="text-lg font-semibold">Your review</h2>
    {!eligibility && !error && <p role="status" className="mt-3 text-sm">Checking your delivered purchases…</p>}
    {eligibility && <p role="status" className="mt-3 text-sm">{submitted ? "Thank you. Your verified purchase review is published." : eligibility.reason}</p>}
    {eligibility?.review && <div className="mt-4 text-sm"><p className="font-medium">{eligibility.review.rating}/5 · {eligibility.review.title}</p><p className="mt-2 whitespace-pre-wrap">{eligibility.review.body}</p></div>}
    {eligibility?.canReview && <form onSubmit={event => void submit(event)} className="mt-5 space-y-4" aria-busy={busy}>
      <fieldset disabled={busy} className="space-y-4">
        <div className="max-w-xs space-y-2"><Label htmlFor="review-rating">Rating</Label><Select value={rating} onValueChange={setRating} required>
          <SelectTrigger id="review-rating"><SelectValue placeholder="Choose a rating" /></SelectTrigger><SelectContent>{[5, 4, 3, 2, 1].map(value => <SelectItem key={value} value={String(value)}>{value} out of 5</SelectItem>)}</SelectContent>
        </Select></div>
        <div className="space-y-2"><Label htmlFor="review-title">Title</Label><Input id="review-title" name="title" maxLength={120} required /></div>
        <div className="space-y-2"><Label htmlFor="review-body">Your experience</Label><Textarea id="review-body" name="body" rows={4} maxLength={2000} required /></div>
      </fieldset>
      <p className="text-sm text-muted-foreground">One review per product. Your account name is shown publicly, not your email or customer ID.</p>
      <Button type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish review"}</Button>
    </form>}
    {error && <div className="mt-4"><p role="alert" className="text-sm text-destructive">{error}</p>{!eligibility && <Button variant="outline" className="mt-3" onClick={() => setRetry(value => value + 1)}>Check again</Button>}</div>}
  </section>;
}
