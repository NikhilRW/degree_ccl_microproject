import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { createCustomerReview } from "@/server/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function ReviewForm({ productId }: { productId: string }) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await createCustomerReview({ data: { productId, title, body, rating } });
      toast.success("Review submitted for admin approval");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review submission failed");
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Review product
      </Button>
    );
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-border p-4">
      <Label>
        Rating
        <select
          className="ml-2 rounded border p-1"
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} stars
            </option>
          ))}
        </select>
      </Label>
      <Label htmlFor={`review-title-${fieldId}`}>Title</Label>
      <Input
        id={`review-title-${fieldId}`}
        value={title}
        required
        minLength={3}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Label htmlFor={`review-body-${fieldId}`}>Review</Label>
      <Textarea
        id={`review-body-${fieldId}`}
        value={body}
        required
        minLength={10}
        onChange={(event) => setBody(event.target.value)}
      />
      <Button type="submit" disabled={busy}>
        Submit review
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
