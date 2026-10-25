import { createServerFn } from "@tanstack/react-start";
import { idSchema, reviewSchema } from "../domain/contracts";
import { authenticated } from "../server/rpc.server";
import * as reviews from "../server/reviews.server";
import { customerMiddleware } from "./customer.functions";

export const reviewEligibilityFn = createServerFn({ method: "POST" }).middleware([customerMiddleware]).validator(idSchema)
  .handler(({ context, data }) => authenticated(context.authentication, user => reviews.eligibility(user, data)));
export const submitReviewFn = createServerFn({ method: "POST" }).middleware([customerMiddleware]).validator(reviewSchema)
  .handler(({ context, data }) => authenticated(context.authentication, user => reviews.submitReview(user, data)));
