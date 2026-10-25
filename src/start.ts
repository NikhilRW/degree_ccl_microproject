import {
  createStart,
  createCsrfMiddleware,
  createMiddleware,
  createIsomorphicFn,
} from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { setResponseHeader } from "@tanstack/react-start/server";
import { getRequest } from "@tanstack/react-start/server";
import { getRuntimeConfig } from "./server/runtime.server";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  // Safe default for dynamic HTML/server functions. Static asset caching belongs
  // to the production proxy/CDN and must not cache admin/customer responses.
  setResponseHeader("Cache-Control", "no-store");
  setResponseHeader("X-Content-Type-Options", "nosniff");
  setResponseHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  const request = getRequest();
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !new URL(request.url).pathname.startsWith("/webhooks/")
  ) {
    const origin = request.headers.get("origin");
    const config = getRuntimeConfig();
    if (config.mode === "cloud" && origin !== config.appUrl)
      return new Response("Invalid request origin", { status: 403 });
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(
      JSON.stringify({
        event: "request.failed",
        code: error instanceof Error ? error.name : "unknown",
      }),
    );
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const matchTrustedOrigin = createIsomorphicFn().server(
  (origin: string, ctx: { request: Request }) => {
    const config = getRuntimeConfig();
    return origin === (config.mode === "cloud" ? config.appUrl : new URL(ctx.request.url).origin);
  },
);
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  origin: (origin, ctx) => matchTrustedOrigin(origin, ctx) === true,
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
