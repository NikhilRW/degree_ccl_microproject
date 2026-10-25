import { createFileRoute } from "@tanstack/react-router";
import { handleRazorpayWebhook } from "@/server/webhook.server";

export const Route = createFileRoute("/webhooks/razorpay")({
  server: { handlers: { POST: ({ request }) => handleRazorpayWebhook(request) } },
});
