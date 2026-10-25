# AWS Setup and Deployment

The application code is implemented; **AWS resources have not been created or live-tested here**. API keys alone cannot create a database, user pool, media bucket, or permissions. Follow this guide, fill `.env`, run the checks/seed command, and complete the final acceptance test.

## 1. Local Prerequisites

- Node.js **22.12+** and optionally Bun for the checked-in `bun.lock`.
- A personal AWS account with MFA, a chosen spending limit, and budget alerts. Alerts are not spending caps. Review current EC2, EBS, IPv4, storage, logs, database, secrets, and transfer pricing.
- Main region: **Mumbai (`ap-south-1`)**. No API Gateway, Lambda, separate Express backend, or Amplify hosting is required.
- No payment-provider account is required. Card and UPI are mock-only; they collect no payment details and charge no money.

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

## 6. Mock payment behavior

Card and UPI choices display a confirmation prompt and create an order marked as
`mocked`. No gateway script is loaded, no payment credentials are required, and
the app collects no card or UPI data. The UI explicitly states that no money is
charged. This is a synthetic demonstration only, not payment authorization or
processing. Cash on delivery remains separate and payment stays pending until
collection.

## 7. IAM and EC2

Create an IAM role trusted by EC2 and attach an instance profile to the instance. Adapt **`deploy/iam-policy.example.json`** with your exact account/resource identifiers. Do not paste the placeholder policy unchanged.

- Application permissions cover the specified DynamoDB table, Cognito pool, S3 prefixes and SES identity.
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

`setup:check` is read-only and checks identifiers, table keys, Cognito flow configuration, bucket access and SES sender. It is **not** a replacement for end-to-end permission/CDN tests. Seeding adds synthetic catalogue records and never overwrites existing records or creates fake cloud customer accounts/orders.

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

Set `APP_URL=https://YOUR-DISTRIBUTION.cloudfront.net` and `MEDIA_BASE_URL` to that URL (or a dedicated media distribution). Update S3 CORS. The application's cloud CSRF/origin validation uses the exact configured public URL, not an untrusted forwarded host.

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
5. Complete a mock card/UPI checkout and confirm the order is labeled simulated, no payment details are requested, and no charge is made; also verify COD remains pending until collection.
6. Exercise repeated checkout submission and cancellation/restock behavior.
7. Admin ships/delivers an order; customer submits a review; admin approves it; public ratings update.
8. Disable a customer and verify old sessions lose protected access. Check audit records and dashboard totals.
9. Restart EC2; verify health, persistence, recovery and CloudWatch logs. Ensure no-cache behavior and private pending uploads.

Only after these tests pass on your account should the deployment be called AWS-connected/lab-ready. Local/mocked tests do not verify your credentials, quotas, email delivery, certificates, or resource policies.

## 11. Updates, Recovery and Cleanup

- Before changes, back up local demo data or configure DynamoDB backups/PITR as appropriate; inspect cost first.
- Deploy a new release directory/build, stop/start the service deliberately, and preserve environment/session key configuration. Roll back the application without rewriting published Git history or deleting live data.
- Mock approval is not a real payment state. Never represent it as a captured/settled charge or use it for real transactions.
- After the lab, stop services, disable/delete the CloudFront distribution when ready, terminate EC2 and review retained EBS/snapshots/IP allocations, and remove only the intended S3/table/Cognito/secret/SES/log/IAM resources. Export needed evidence/data first.
- Stopping EC2 alone does not stop every bill. Check the account's billing/resource inventory after teardown.
