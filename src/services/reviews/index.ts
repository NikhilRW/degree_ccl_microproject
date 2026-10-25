import type { z } from "zod";
import type { reviewSchema } from "@/domain/contracts";
import { reviewEligibilityFn, submitReviewFn } from "@/functions/reviews.functions";
import { unwrap } from "../rpc";

export const reviewService = {
  eligibility: (productId: string) => unwrap(() => reviewEligibilityFn({ data: productId })),
  submit: (data: z.infer<typeof reviewSchema>) => unwrap(() => submitReviewFn({ data })),
};
