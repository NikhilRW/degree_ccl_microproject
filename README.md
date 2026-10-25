# IntelliMart

A React, TypeScript and TanStack Start full-stack storefront using AWS SDK v3 on the server.

- Cognito customer authentication and email verification
- Typed same-origin TanStack server functions and SSR on an EC2 Node.js server
- DynamoDB catalogue, cart, wishlist and orders
- Private S3 file storage
- SES order-confirmation emails
- COD and clearly labeled mock card/UPI checkout with transactional inventory updates; mock approvals never charge money

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

Payment gateway processing is intentionally not connected. Card/UPI checkout only records a simulated approval, collects no payment details, and charges no money; COD remains available. A new DynamoDB table contains no products until you import them, and customer operations require a real Cognito account.

## Code and deployment boundaries

- `src/server/*.server.ts`: server-only AWS clients, Cognito/session handling, catalogue and customer transactions.
- `src/functions/*.functions.ts`: validated typed RPC functions. Customer middleware derives identity from the server session, never a client-provided user ID.
- `src/services/`: browser-safe adapters calling those functions; no API base URL or browser token persistence.
- `backend/`: CDK infrastructure, actual-catalogue importer, local configuration script, and the separate DynamoDB Streams → SES worker with SQS failure handling. Resource provisioning deliberately stays outside the application source.

Authentication uses a random HttpOnly, SameSite=Lax cookie (Secure with a `__Host-` prefix in production). Only a hash of its ID keys the DynamoDB session record; Cognito access/refresh tokens never go to the browser. Each protected call checks the live session and expiry. Refresh rotation uses a cross-instance conditional DynamoDB lock/version check, and logout deletes the session before revoking its Cognito refresh token. Existing TanStack CSRF protection and the SSR error entry remain enabled.

`bun run build` targets Nitro's `node-server` preset. `bun run start` starts the generated `.output/server/index.mjs`; Nitro serves static files from `.output/public`. On EC2, run the Node process behind Nginx with HTTPS. DynamoDB, Cognito, private media S3, and SES remain AWS-managed services. See [the EC2 deployment runbook](docs/ec2-deployment.md).

The frontend remains connected to Lovable. See `AGENTS.md` for repository history guidance.
