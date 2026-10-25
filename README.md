# IntelliMart

A React, TypeScript and TanStack Start full-stack storefront using AWS SDK v3 on the server.

- Cognito customer authentication and email verification
- Typed same-origin TanStack server functions and SSR in one AWS Lambda
- DynamoDB catalogue, cart, wishlist and orders
- Private S3 file storage
- SES order-confirmation emails
- Cash-on-delivery checkout with transactional inventory updates

## Setup

1. Install application dependencies with `bun install --frozen-lockfile` and infrastructure dependencies with `npm.cmd --prefix backend ci`.
2. Provision resources and import your real catalogue using [backend/README.md](backend/README.md). There is no separate web backend/API to configure.
3. Run `npm.cmd --prefix backend run configure:local` after provisioning. This writes server-only resource identifiers to root `.env.local` (see `.env.example`). Supply your normal local AWS SDK credentials/profile; never put keys in browser variables.
4. Start with `bun run dev`. Vite loads the allowlisted non-`VITE_` settings into the server process, not browser code. Local server functions call AWS directly, just like production.

```sh
bun run build
bun run typecheck
npm.cmd --prefix backend run typecheck
```

There is no demo-mode fallback. A new DynamoDB table contains no products until you import them, and customer operations require a real Cognito account. Online card/UPI processing is not connected; checkout supports cash on delivery.

## Code and deployment boundaries

- `src/server/*.server.ts`: server-only AWS clients, Cognito/session handling, catalogue and customer transactions.
- `src/functions/*.functions.ts`: validated typed RPC functions. Customer middleware derives identity from the server session, never a client-provided user ID.
- `src/services/`: browser-safe adapters calling those functions; no API base URL or browser token persistence.
- `backend/`: CDK infrastructure, actual-catalogue importer, local configuration script, and the separate DynamoDB Streams → SES worker with SQS failure handling. Resource provisioning deliberately stays outside the application source.

Authentication uses a random HttpOnly, SameSite=Lax cookie (Secure with a `__Host-` prefix in production). Only a hash of its ID keys the DynamoDB session record; Cognito access/refresh tokens never go to the browser. Each protected call checks the live session and expiry. Refresh rotation uses a cross-instance conditional DynamoDB lock/version check, and logout deletes the session before revoking its Cognito refresh token. Existing TanStack CSRF protection and the SSR error entry remain enabled.

`bun run build` targets Nitro's `aws_lambda` preset. CDK packages the generated `server/index.mjs` handler and uploads generated public files to a private S3 bucket. An HTTP API forwards **all** SSR, RPC and static requests to this Start Lambda, providing one public HTTPS origin. The server reads static files from S3; it does not call the retired operation-specific API. This deliberately simpler baseline avoids proxy-host/CSRF configuration and CloudFront/Lambda POST-signing pitfalls, at the cost of a Lambda invocation for static assets. See the infrastructure guide for build-first provisioning, upload CORS and production limits.

The frontend remains connected to Lovable. See `AGENTS.md` for repository history guidance.
