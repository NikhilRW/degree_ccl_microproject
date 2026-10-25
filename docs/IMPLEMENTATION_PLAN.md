# IntelliMart Implementation Status

## Agreed Scope

Cloud computing lab, a personal AWS account with minimal spending, Mumbai (`ap-south-1`), EC2 hosting with TanStack server functions, Razorpay test payments, SES verified recipients, and all agreed admin feature groups. No API Gateway/Lambda/Express backend or Amplify hosting is required. Infrastructure setup is performed by the user following the Console guide; this coding session has not created AWS resources.

## Application Code Implemented

- [x] Standalone Vite/TanStack/React/Tailwind/Nitro Node build and production launcher.
- [x] Complete `.env.example`, strict cloud validation, server-only import protection, health endpoint and non-cached dynamic traffic.
- [x] Separate persisted single-process demo and transactional DynamoDB adapters; idempotent seed command and read-only setup checks.
- [x] Cognito registration, email confirmation/resend, sign-in/out and password-reset flows.
- [x] Opaque HttpOnly cookie sessions, encrypted server-side identity tokens, JWT verification and live Cognito revocation/account/group checks.
- [x] Server-enforced customer ownership and administrator permissions. Public signup cannot assign roles.
- [x] Profiles/addresses, account-aware cart/wishlist persistence, bounded validated quantities, and idempotent guest merging.
- [x] Server-side integer-paise pricing, stock reservation transactions, order snapshots and duplicate-checkout protection.
- [x] COD plus Razorpay test checkout, provider details/signature validation, raw-body webhooks and deduplication.
- [x] Inventory release on cancellation/expiry, captured-payment reconciliation, late-payment compensation, test refunds and restart-safe recovery records.
- [x] Order history/details/cancellation, admin fulfilment transitions, payment reconciliation and stored-record dashboard summaries.
- [x] Product/stock/price/featured-deal management, archive/restore and category management with stale-edit checks.
- [x] Admin-only S3 signed uploads, size/MIME/magic-byte validation, private pending objects and published media.
- [x] Customer enable/disable with live identity checks and protection of administrator accounts.
- [x] Delivered-purchase review eligibility, deduplication, moderation and public rating recalculation.
- [x] SES welcome/confirmation/shipping email, durable leases/retry state, and order independence from email failure.
- [x] Administrative audit records, sanitized operational logging and CloudWatch agent example.
- [x] Customer/admin screens connected to server functions; browser auth/order/payment success mocks removed.
- [x] AWS Console/runbook guidance, least-privilege policy examples, service/proxy/log configuration and cleanup guidance.

## Local Verification

Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:smoke` on Node 22.12+.

Tests include mocked Cognito and Razorpay/SES boundary behavior in addition to local persistence and cryptography. They verify live-role checks, token handling, ownership, conditional writes, stock transitions, idempotency, refund/expiry handling, review eligibility and webhook verification. Mocked tests **do not establish a verified AWS deployment**. See the coding session's final report for the actual check results.

Local verification: production Node build, TypeScript check, 40 tests and production smoke checks pass. Browser testing also exercised real server-function sign-in, persisted cart, COD checkout, admin shipping/delivery, and eligible review submission/moderation using isolated synthetic data. Full lint has no errors; existing Fast Refresh warnings remain. Live AWS/provider verification is separate from these demo/mocked tests. Inherited formatting issues were cleaned up without disabling lint rules.

## Remaining User Setup and Live Acceptance

- [ ] Choose a numeric budget; secure the AWS account and review service pricing/free-tier eligibility.
- [ ] Create the DynamoDB PK/SK table, Cognito pool/client/admin group, private S3 bucket, SES identities and payment secret.
- [ ] Attach the supplied scoped permissions to an EC2 role; replace every policy/configuration placeholder.
- [ ] Enter actual environment identifiers and a generated session key securely.
- [ ] Obtain Razorpay **test** account access and configure capture/webhook delivery.
- [ ] Run setup checks and seeding; deploy/build on EC2's Linux environment.
- [ ] Configure CloudFront routing/caching/headers, S3 OAC/CORS, and safe origin transport/access.
- [ ] Install/configure CloudWatch shipping, retention and selected alarms.
- [ ] Complete [the live acceptance checklist](AWS_SETUP.md#10-acceptance-test), including two-account isolation, failed/duplicate payments, refunds, SES delivery, private uploads and restart recovery.
- [ ] Capture lab evidence without secrets and rehearse scoped resource cleanup.

## Boundaries That Must Remain Honest

- API keys alone do not create AWS resources or permissions. This repository provides code, configuration and instructions, not an already-provisioned environment.
- Demo mode is intentionally insecure identity simulation. Cloud mode requires complete configuration and never falls back to demo success.
- The current college-scale model bounds catalogue/order/review reads to 1,000 records per entity type. Expansion requires indexed pagination/search/aggregation work.
- Cognito MFA and temporary-password/new-password challenges are not implemented; use the documented verified-user/password flow for this lab.
- Payments are test-only. There is no real-money operation, courier integration, coupon engine, tax compliance or production certification claim.
- SES submission is not guaranteed inbox delivery; email processing is at-least-once under infrastructure failure.
- Viewer HTTPS is distinct from EC2 origin TLS. HTTP-origin demonstrations require synthetic data only; configure proper origin TLS before handling real credentials/customer data.
- Actual integration behavior still depends on account permissions, quotas, service settings, email verification, domain/certificate choices and provider availability.
