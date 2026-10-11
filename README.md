# IntelliMart: A Cloud-Based E-Commerce and AWS Learning System

A cloud computing lab project built with **TanStack Start, React, TypeScript, Tailwind CSS and AWS SDKs**.

> **Status:** Customer/admin application code and demo/cloud adapters are implemented. Local tests and mocked service tests can run without AWS. **AWS resources, credentials, policies, certificates, email identities and an actual cloud deployment have not been configured or verified here.** This is a college-scale, test-payment system—not a production-readiness guarantee.

## 1. Abstract

IntelliMart provides an online shopping experience and demonstrates practical cloud computing concepts. Customers browse categories/products/deals, search and filter the catalogue, view product details and approved reviews, manage a cart and wishlist, register/sign in, edit their profile and addresses, complete checkout, view order history, cancel eligible orders, and review delivered purchases.

Administrators manage products, prices, stock, featured deals and categories; upload validated images; process orders; reconcile payments; enable/disable customers; moderate reviews; and view catalogue/sales summaries and audit records. Cloud authorization is checked server-side against verified Cognito identity and current administrator-group membership, not browser-provided roles or hidden links.

The same TanStack Start application provides React UI, server rendering and backend server functions. It builds into a standalone Node.js runtime suitable for EC2. There is no separate Express/REST backend or API Gateway/Lambda layer. Demo mode stores synthetic records locally and simulates authentication, payment and email. Cloud mode connects directly to configured Cognito, DynamoDB, S3, SES and Secrets Manager resources and uses Razorpay **test mode**.

## 2. Cloud Services Used

These integrations are implemented in code; their AWS deployment must still be configured and tested.

- **Amazon EC2:** complete Node application runtime, SSR, server functions and recovery processing.
- **Amazon CloudFront:** HTTPS application delivery and media caching; protected/dynamic traffic must not be cached.
- **Amazon DynamoDB:** one composite-key table for application records and revision-checked transactions. No GSI is required by the current bounded lab model.
- **Amazon Cognito:** registration/verification, login, password reset, token validation/revocation, and administrator-group checks.
- **Amazon S3:** private image storage; limited signed uploads, server-side validation, and publishing through CloudFront OAC.
- **Amazon SES:** welcome, order-confirmation and shipping emails with persisted retry state. Sandbox recipients require verification.
- **AWS Secrets Manager:** Razorpay test keys and webhook signing secret; server-only environment configuration is an alternative.
- **AWS IAM:** resource-scoped EC2 role permissions; AWS SDK default credential chain, not browser credentials.
- **Amazon CloudWatch:** provided agent configuration for logs and EC2 memory/disk metrics. Installation, retention and alarms are setup tasks.
- **ACM / Route 53:** conditional domain/certificate/DNS choices; not required for the default CloudFront viewer domain. Origin TLS is a separate security requirement.

Razorpay is an external payment provider, not an AWS service. The app rejects live key IDs and never collects raw card numbers/CVC.

## 3. Workflow Summary

1. Open the storefront; public server functions read active catalogue records and approved reviews.
2. Register/verify/sign in. Cloud tokens are verified and encrypted in persisted server sessions, bound to the session identity and expiry. Only a hash of the bearer cookie is stored; the browser receives an opaque HttpOnly cookie.
3. Merge guest shopping data once into the signed-in account. Signed-in carts/wishlists persist server-side; guest data remains browser-local.
4. Checkout uses current server-side product prices, stock and integer-paise totals. A conditional transaction reserves inventory and creates an idempotent order.
5. COD creates an unpaid processing order. Card/UPI invokes Razorpay test checkout (or a labelled demo simulation); only verified captured payments confirm a paid order.
6. Verified webhooks and a recurring recovery worker handle retries, abandoned reservations, late payments and refunds without duplicate stock changes. Customers can resume a pending test payment from their account without creating another reservation.
7. Email is queued independently of order persistence; failed SES submission does not invalidate the order.
8. Admins process fulfilment; customers view their own orders and submit reviews for delivered purchases; approved reviews update public ratings.

Delivery statuses are manual/admin-managed, not courier tracking. The example 18% tax and delivery rules are lab rules, not tax-compliance advice.

## 4. System Architecture

```text
Customer / Administrator browser
                  |
          CloudFront (viewer HTTPS)
            |                  |
     dynamic requests     /media/* cache
            |                  |
     EC2 reverse proxy      Private S3 (OAC)
            |
     TanStack Start Node application
     React UI + SSR + server functions
            |
            +-- Cognito: identity and live admin checks
            +-- DynamoDB: records, sessions, inventory/order transactions
            +-- S3: limited uploads and validated image publication
            +-- Secrets Manager + Razorpay test APIs: payments
            +-- SES: transactional email and retry state
            +-- CloudWatch agent: operational logs/metrics

     EC2 IAM role governs AWS access
```

Browser-to-CloudFront HTTPS does **not** imply CloudFront-to-EC2 encryption. Configure a trusted HTTPS origin before using real credentials/customer data. An HTTP-origin demonstration is only a documented synthetic-data lab exception. See [AWS setup](docs/AWS_SETUP.md).

## 5. Services Not Required Initially

API Gateway, Lambda, Amplify Hosting, OpenSearch, SQS, EventBridge, SNS and additional database services are not prerequisites for this design. WAF, advanced search, larger-scale indexed pagination and decoupled workers are possible future production enhancements.

## 6. Conclusion and Readiness Boundary

IntelliMart now includes the customer/admin application code and the server-side AWS integrations needed for the selected lab design. Your remaining work is resource/account configuration, environment values, deploying the application, seeding data, and performing the live acceptance checklist. API keys alone cannot supply missing infrastructure.

The system intentionally limits catalogue/order/review aggregate reads to **1,000 records per entity type**. It supports the agreed college-scale demonstration, not an unlimited production marketplace. MFA/new-password challenges are not implemented by the custom login; configure the documented Cognito flow. Email retries are at-least-once, and actual cost/free-tier eligibility depends on your account and usage.

## 7. Run Locally Without AWS

Use **Node 22.12+**. The current workspace's system Node 20.10 is too old; previous verification used a temporary Node 22 binary without replacing it.

```sh
bun install --frozen-lockfile
```

Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`), then:

```sh
npm run dev
```

Open `http://127.0.0.1:3000`. The example explicitly enables demo administration at `/admin`; without `INTELLIMART_DEMO_ADMIN=true`, it is disabled. **Demo administration is not secure authentication. Anyone reaching an enabled demo server can administer it.** Keep it local and use synthetic data and disposable passwords.

Demo records persist in `.data/application.json`. Existing edits in the legacy `.data/catalogue.json` are imported when the application data store is first written; the legacy file is not modified. Demo identities use opaque sessions too, but password checks are simulated. Set a valid stable `SESSION_SECRET` to preserve demo session decryption across restarts; without one, restart requires signing in again while data remains persisted.

Back up local data before intentionally resetting it. File storage supports **one application process only**. Cloud mode never silently falls back to demo data or simulated payments.

## 8. Connect AWS Later

Follow **[docs/AWS_SETUP.md](docs/AWS_SETUP.md)**. It specifies the table schema, Cognito settings, private S3/CORS/OAC setup, SES identities, test-payment secret format, IAM role, CloudFront behavior, deployment and cleanup.

Once resources exist, fill `.env` and set `INTELLIMART_MODE=cloud` and `INTELLIMART_DEMO_ADMIN=false`:

```sh
npm run setup:check
npm run seed
npm run build
npm run start
```

`setup:check` is read-only. The seed command adds sample catalogue data without overwriting existing records or creating fake cloud customers/orders. Use an EC2 IAM role; local cloud testing may use an AWS profile or temporary credentials. Do not put secrets in `VITE_*`, Git, screenshots, or chat.

## 9. Checks and Operations

```sh
npm run typecheck
npm test
npm run build
npm run test:smoke
npm run lint
```

Tests exercise configuration, authorization boundaries, encryption, ownership, pricing, inventory, idempotency, refunds/recovery, reviews, webhook signatures and email failure handling. External-service tests use mocks; they do not prove your AWS configuration or a real provider callback works.

The Node build outputs `.output/server/index.mjs` and `.output/public/`. The launcher validates server configuration and loads `.env`. `/health` is a non-cached liveness endpoint, not an AWS readiness probe. Build on Linux for Linux EC2 deployment.

An in-process recovery timer starts after the first request and runs every minute. Admins can trigger recovery manually. An independent cloud-only worker is available via `npm run maintenance`; the local file demo must remain single-process. Application/service, reverse-proxy, IAM, OAC, CORS and CloudWatch examples are in `deploy/` and must have placeholders replaced.

Inherited formatting issues have been cleaned up. Full lint has no errors (existing React Fast Refresh warnings remain). No published Git history has been rewritten.

## 10. Repository Map

- `src/routes/`: customer/admin pages, verification/reset flows, health and payment webhook route.
- `src/server/`: authorization, records/adapters, catalogue, shopping, pricing, orders/payments, email, media and recovery.
- `src/services/`: browser-facing service adapters; credentials/SDKs stay on the server.
- `src/hooks/`: account-aware cart/wishlist/auth state and guest merge.
- `src/config/runtime.ts`: validated server configuration and cloud requirements.
- `src/data/`: synthetic lab catalogue and demo-only sample orders.
- `.env.example`: complete configuration template with no actual secrets.
- `scripts/`: start, seed, read-only setup checks, recovery worker and production smoke test.
- `deploy/`: operator configuration examples; these do not provision AWS automatically.
- `docs/AWS_SETUP.md`: setup/deployment/acceptance/cleanup guide.
- `docs/IMPLEMENTATION_PLAN.md`: implementation status and remaining live verification.
