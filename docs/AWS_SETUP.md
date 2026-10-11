# AWS Setup and Deployment

The application code is implemented; **AWS resources have not been created or live-tested here**. API keys alone cannot create a database, user pool, media bucket, or permissions. Follow this guide, fill `.env`, run the checks/seed command, and complete the final acceptance test.

## 1. Local Prerequisites

- Node.js **22.12+** and optionally Bun for the checked-in `bun.lock`.
- A personal AWS account with MFA, a chosen spending limit, and budget alerts. Alerts are not spending caps. Review current EC2, EBS, IPv4, storage, logs, database, secrets, and transfer pricing.
- Main region: **Mumbai (`ap-south-1`)**. No API Gateway, Lambda, separate Express backend, or Amplify hosting is required.
- A Razorpay account that provides **test-mode** credentials. Live keys are rejected by code.

```sh
bun install --frozen-lockfile
```

Copy `.env.example` to `.env`. Leave `INTELLIMART_MODE=demo` while setting up. Never commit `.env`, share real secrets in chat/screenshots, or use secrets in `VITE_*` variables.

## 2. DynamoDB

In DynamoDB → Tables → Create table:

1. Table name: for example `intellimart-lab`.
2. Partition key: **`PK` (String)**.
3. Sort key: **`SK` (String)**.
4. Use on-demand capacity for the small lab dataset; check pricing before creation. No GSI is required by this implementation.
5. After creation, enable TTL on **`expiresAt`**. This cleans up expired sessions/webhook/merge records. **Do not TTL-delete pending orders**: inventory release is application business logic.
6. Set `DYNAMODB_TABLE` to the table name.

Rows are grouped by entity (`PRODUCT`, `CATEGORY`, `PROFILE`, `CART`, `WISHLIST`, `ORDER`, etc.) and store a revision plus the domain value. Conditional DynamoDB transactions protect stock and concurrent edits. Catalogue/order/review lists are intentionally bounded to **1,000 rows per entity type** for this college-scale system. Audit and session cleanup use pages. Larger deployments need indexed, paginated access patterns rather than treating this as an unlimited marketplace design.

## 3. Cognito

Create a user pool with:

- Email sign-in, self-registration, and email verification.
- Email account recovery; require suitable passwords (at least eight characters; match any configured complexity requirements).
- **MFA disabled for this lab flow**. Custom login does not implement MFA/new-password challenge screens.
- Standard email/name attributes. Public signup must not grant administrator groups or writable role attributes.

Create an app client **without a client secret**, with:

- `ALLOW_USER_PASSWORD_AUTH`.
- `ALLOW_REFRESH_TOKEN_AUTH`.
- Refresh-token rotation **disabled**, since this code uses `REFRESH_TOKEN_AUTH`.
- Access token lifetime around one hour, refresh token lifetime at least seven days, and token revocation enabled.
- Read/write the required standard `email` and `name` attributes. These custom forms do not require a managed-login callback URL or Hosted UI domain.

Set `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, and `COGNITO_ADMIN_GROUP=admin`.

Create the `admin` group. Once the application is connected, register a test administrator through `/register`, verify the email code, then add that user to the group in the Cognito Console. Sign out/in or reload afterward. Avoid an uncompleted temporary-password user created through `AdminCreateUser`; the app deliberately rejects unsupported challenges rather than bypassing them.

The server verifies token signatures/issuer/client/token-use, uses Cognito `GetUser` for token revocation, checks the account's live enabled state, and reads live group membership. Identity tokens remain encrypted in server-side session records, with authenticated binding to the session/identity/expiry. Only a hash of the bearer cookie is stored; the browser gets an opaque HttpOnly cookie. All admin operations recheck authorization, independent of navigation links.

Generate a stable session encryption key locally:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put it in `SESSION_SECRET`. Changing it invalidates existing sessions. Do not print this value into application logs.

## 4. S3 Product Images

Create a globally unique private S3 bucket in Mumbai:

- Keep **Block Public Access enabled** and ACLs disabled.
- Use standard server-side encryption (SSE-S3). If choosing customer-managed KMS encryption, add the required KMS permissions deliberately.
- Set `S3_MEDIA_BUCKET`.
- Add the CORS configuration in `deploy/s3-cors.example.json`, replacing the origin with the exact final `APP_URL`. Add a localhost origin only for intentional local cloud testing.
- Add a lifecycle rule to delete abandoned **`uploads/pending/`** objects after one day.

Admins upload JPEG/PNG/WebP files up to 5 MB using short-lived signed POST policies. The server verifies size, MIME and file signatures before copying an object into **`media/`**. CloudFront must never serve the pending upload prefix. Historical product images are retained when products are archived.

## 5. SES Email

In SES → Verified identities, verify the sender email and each demo recipient in **Mumbai**. Set `SES_FROM_EMAIL` to the sender's email address.

- SES sandbox cannot send to arbitrary unverified recipients. A Cognito-verified email is **not automatically an SES-verified recipient**.
- Cognito verification/password-reset email is separate from the application's SES welcome/order/shipping email.
- Email submission failures are persisted and retried; they do not undo a paid order.
- A successful SES submission does not guarantee inbox delivery. Recovery is at-least-once; an infrastructure failure after SES acceptance but before recording success can cause a duplicate email.

Production SES approval is unnecessary for a lab using verified recipients, but required if you later need unrestricted recipients.

## 6. Razorpay Test Mode and Secrets Manager

In the Razorpay test dashboard:

1. Obtain a key ID beginning **`rzp_test_`** and its secret.
2. Configure automatic capture for test payments. The application confirms only provider-reported **captured** payments with the matching order, INR currency, and amount.
3. Create a webhook at **`https://YOUR-DISTRIBUTION.cloudfront.net/webhooks/razorpay`**, subscribing to `payment.captured` and `order.paid`.
4. Choose a webhook secret of at least 16 characters. The app verifies the raw body signature, deduplicates delivery, and returns retryable errors if processing fails.

In Secrets Manager, store a plaintext JSON secret (not a browser variable):

```json
{
  "keyId": "rzp_test_REPLACE",
  "keySecret": "REPLACE_WITH_TEST_SECRET",
  "webhookSecret": "REPLACE_WITH_WEBHOOK_SECRET"
}
```

Set `RAZORPAY_SECRET_ID` to its name or ARN. Alternatively, set all three server-only `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` values in `.env`; the managed secret takes precedence if configured. Never use live keys or enter card data into application forms—Razorpay collects test payment details in its own checkout.

Pending checkout reserves stock for `CHECKOUT_RESERVATION_MINUTES` (default 30). A recurring worker reconciles captured payments, releases abandoned reservations, and retries refunds. A late captured payment after cancellation is refunded rather than fulfilling unavailable stock. Same-checkout retries share an idempotency key; if changing shipping/payment details, cancel the old pending checkout and start a new one. Keep the runtime/recovery worker running for these operations.

## 7. IAM and EC2

Create an IAM role trusted by EC2 and attach an instance profile to the instance. Adapt **`deploy/iam-policy.example.json`** with your exact account/resource identifiers. Do not paste the placeholder policy unchanged.

- Application permissions cover the specified DynamoDB table, Cognito pool, S3 prefixes, SES identity, and payment secret.
- Transactional table writes use the underlying DynamoDB item actions; do not invent an unsupported IAM action for the transaction envelope.
- If your secret uses a customer-managed KMS key, add scoped `kms:Decrypt` access and the necessary key policy.
- Operator provisioning permissions are separate from application permissions.
- On EC2, do **not** store AWS access keys. The SDK uses the instance role. For local cloud tests, use an AWS CLI/SSO profile or temporary credentials, including the session token when applicable.

Create a cost-conscious Linux EC2 instance with sufficient memory/storage to build the app. Build on the target OS/architecture, not by copying a Windows build and assuming compatibility. Prefer Systems Manager access; otherwise restrict SSH to your IP. Never expose the Node development/application port directly to the internet.

Install a supported Node runtime, clone/copy the repository, install dependencies, and configure the production `.env`. Set `INTELLIMART_MODE=cloud`, `INTELLIMART_DEMO_ADMIN=false`, all resource fields, and the exact application URL. Keep `.env` readable only by the application user.

```sh
npm run setup:check
npm run seed
npm run typecheck
npm test
npm run build
npm run test:smoke
npm run start
```

`setup:check` is read-only and checks identifiers, table keys, Cognito flow configuration, bucket access, SES sender and test-secret format. It is **not** a replacement for end-to-end permission/CDN/payment tests. Seeding adds synthetic catalogue records and never overwrites existing records or creates fake cloud customer accounts/orders.

`deploy/intellimart.service` is a systemd example. Create the non-root `intellimart` user, `/opt/intellimart`, and `/var/log/intellimart/application.log` with correct ownership. Adjust `ExecStart` to the actual Node path. Keep source/dependencies alongside the build because the launcher validates configuration through `tsx`. Install/enable the service after testing the commands manually.

The Node runtime binds to `127.0.0.1:3000`. Use a reverse proxy such as the supplied Nginx example. The in-process recovery timer starts after the first request and runs every minute; it resumes after process restart. An optional independent **cloud-only** worker can run with `npm run maintenance` or once with `npm run maintenance -- --once`. Transactions/leases protect concurrent retries; the file demo must remain single-process.

## 8. CloudFront and Origin Security

Configure a distribution with:

- EC2 reverse-proxy origin for the application.
- S3 REST origin with **Origin Access Control** for media.
- Default behavior: all required HTTP methods; **CachingDisabled**; forward cookies, query strings, `Origin`, `Referer`, and fetch-metadata headers. A managed AllViewerExceptHostHeader origin request policy is suitable when verified against your configuration. Do not cache personalized HTML, auth, server functions or webhooks.
- `/media/*` behavior: S3 origin, GET/HEAD, long-lived caching, no customer cookies. Keep `/uploads/*` unroutable and denied by the bucket policy.
- Viewer protocol: redirect HTTP to HTTPS. The default CloudFront domain uses its managed certificate; no custom storefront ACM certificate or Route 53 zone is needed.
- S3 bucket policy: adapt **`deploy/s3-oac-policy.example.json`** to allow only that distribution to read `media/*`.

Set `APP_URL=https://YOUR-DISTRIBUTION.cloudfront.net` and `MEDIA_BASE_URL` to that URL (or a dedicated media distribution). Update S3 CORS and the Razorpay webhook URL. The application's cloud CSRF/origin validation uses the exact configured public URL, not an untrusted forwarded host.

**Important:** Viewer HTTPS does not encrypt CloudFront-to-EC2 HTTP. For real credentials/customer data, configure an HTTPS origin with a trusted certificate matching the origin hostname, restrict origin ingress, and use a secret CloudFront origin header as shown in the Nginx example. This may require an origin domain/certificate even if the storefront uses only the default CloudFront domain. Without it, an HTTP-origin demonstration is a **synthetic-data lab exception**, not a production-secure deployment. Do not reuse real passwords or claim full transport security for that exception.

## 9. CloudWatch

Install the CloudWatch agent and adapt **`deploy/cloudwatch-agent.example.json`**. It ships the systemd application's log file and memory/disk metrics to Mumbai under the `IntelliMart` namespace.

- Create `/intellimart/application` and choose a short retention period (for example 7 days) in the Console.
- Verify agent file permissions and IAM permissions.
- Add selected EC2 status/CPU and log error alarms, with verified notification targets if desired.
- Never ship `.env`, identity tokens, payment keys, full request bodies, or customer addresses to logs. CloudWatch integration is an operational setup step; EC2 alone does not enable log shipping.

## 10. Acceptance Test

1. Register/verify a customer and exercise password reset/sign-out/sign-in.
2. Confirm a normal customer cannot execute admin operations, even with direct server-function calls.
3. Admin creates/edits a product, uploads an image, and manages a category/deal.
4. Customer cart/wishlist survives reload and a second browser after sign-in; two customers cannot read each other's data/orders.
5. Complete a Razorpay **test** payment, verify the stored paid order and stock, and receive a test email at a verified recipient.
6. Exercise failed/dismissed/duplicate payment delivery, cancellation/refund, and expired reservation recovery.
7. Admin ships/delivers an order; customer submits a review; admin approves it; public ratings update.
8. Disable a customer and verify old sessions lose protected access. Check audit records and dashboard totals.
9. Restart EC2; verify health, persistence, recovery and CloudWatch logs. Ensure no-cache behavior and private pending uploads.

Only after these tests pass on your account should the deployment be called AWS-connected/lab-ready. Local/mocked tests do not verify your credentials, quotas, email delivery, certificates, or resource policies.

## 11. Updates, Recovery and Cleanup

- Before changes, back up local demo data or configure DynamoDB backups/PITR as appropriate; inspect cost first.
- Deploy a new release directory/build, stop/start the service deliberately, and preserve environment/session key configuration. Roll back the application without rewriting published Git history or deleting live data.
- Use the admin recovery button and persisted order/payment references to investigate failed workflows. Paid cancellations remain `refund_pending` until verified provider processing; do not manually mark failures paid.
- After the lab, stop services, disable/delete the CloudFront distribution when ready, terminate EC2 and review retained EBS/snapshots/IP allocations, and remove only the intended S3/table/Cognito/secret/SES/log/IAM resources. Export needed evidence/data first.
- Stopping EC2 alone does not stop every bill. Check the account's billing/resource inventory after teardown.
