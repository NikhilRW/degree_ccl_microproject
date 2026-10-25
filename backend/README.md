# IntelliMart infrastructure and email worker

The **web backend is TanStack Start code under `src/server/`**, exposed by typed `src/functions/*.functions.ts`. It calls AWS SDK v3 directly, not old HTTP Lambda handlers. The storefront is transitioning to EC2; follow [the EC2 deployment runbook](../docs/ec2-deployment.md). The current CloudFormation stack remains live until EC2 verification and cutover.

## Runtime

| Concern | Implementation |
| --- | --- |
| Web application | Nitro `node-server` build, run by Node.js 22 on EC2 |
| Public origin | Nginx reverse proxy with TLS on the EC2 host; same-origin SSR and TanStack RPCs |
| Static files | Nitro serves `.output/public`; product/customer uploads and private product images remain in S3 |
| Authentication | Cognito password login, verified email, confirmation/resend and password-reset codes |
| Sessions | Opaque HttpOnly/Secure-production/SameSite=Lax cookie; SHA-256 ID key and tokens in DynamoDB, absolute seven-day TTL |
| Authorization | Every customer RPC checks a live unexpired session; identity comes only from the session established with Cognito GetUser |
| Rotation/logout | Conditional refresh lock + versioned DynamoDB update; logout deletes the row and revokes the refresh token; refresh cannot recreate a deleted row or set a new cookie |
| Shopping data | Existing DynamoDB catalogue, customer cart/wishlist/orders layout and shared authoritative totals |
| Orders | Transaction checks stock, price and cart revision; decrements inventory, deletes ordered cart lines, saves pending COD order and customer-scoped idempotency record atomically |
| Cancellation | Processing-only, transactional restock |
| Files | Private media S3 with constrained five-MiB presigned POST and customer-scoped download/delete |
| Order email | DynamoDB Streams → separate SES Lambda; SQS failure queue; at-least-once delivery |
| Analytics | Authenticated DynamoDB events with thirty-day TTL |

The Cognito client has no secret, disables OAuth/hosted-UI defaults, and enables refresh rotation with a ten-second grace period. No browser bearer tokens, token query parameters, custom password database, mock records or browser-storage authentication fallback exist. CSRF middleware remains installed for every server function. Session rows must be protected like secrets; use least-privilege operator access to the table/backups and never log their contents.

## Install and build

From the repository root:

```sh
bun install --frozen-lockfile
npm.cmd --prefix backend ci
bun run typecheck
bun run build
```

Use `npm.cmd` on Windows to forward flags reliably (`npm` is fine on other systems). The Lovable Vite wrapper supplies the plugins; `vite.config.ts` selects Nitro's `node-server` preset and keeps the custom server entry. The generated entry is `.output/server/index.mjs`; public files are in `.output/public`. `bun run start` runs the generated server. Do not commit generated output. The EC2 host is ARM64; if adding native dependencies, build on Linux ARM64 or build directly on the host.

## Provisioning and deployment (operator actions, not run automatically)

Use your real AWS CLI/SDK profile. Default region: `ap-south-1`, overridable with `AWS_REGION` or CDK environment. Run these commands **from `backend/`**, after the root build:

```sh
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-south-1
npm.cmd run synth -- --context senderEmail=you@example.com
npm.cmd run diff -- --context senderEmail=you@example.com
npm.cmd run deploy -- --context senderEmail=you@example.com
npm.cmd run configure:local
```

Always review the diff before deploying. Synth builds only the email worker and assembles CloudFormation/assets; it neither provisions AWS nor validates live permissions. `deploy` records real stack outputs in ignored `backend/outputs.json`. `configure:local` copies `TABLE_NAME`, `MEDIA_BUCKET`, `COGNITO_CLIENT_ID`, `COGNITO_USER_POOL_ID`, and `AWS_REGION` to root `.env.local`, preserving unrelated settings and removing the obsolete API URL setting. It never writes AWS credentials. Restart `bun run dev` after changes.

The build does not require live resource IDs or AWS calls: runtime settings come from the Lambda environment, not values baked into JavaScript. For an **initial new stack only**, you may provision stateful resources/email first:

```sh
npm.cmd run deploy -- --context senderEmail=you@example.com --context resourcesOnly=true
npm.cmd run configure:local
```

Then build the root app and deploy normally **without** `resourcesOnly`. Never set `resourcesOnly=true` on a stack already hosting the app: doing so removes its app/API resources. The CDK bootstrap stack is a separate AWS prerequisite, not an application mock or fabricated endpoint.

### Browser-upload CORS

The app's public URL is the `StorefrontUrl` output. SSR, shopping RPCs and static assets work at that one origin immediately. Media uploads go directly to the private media bucket with a narrowly signed form. On the first application deploy, the new API endpoint is not yet known; referencing it from media CORS would create a CloudFormation dependency cycle. After obtaining the real URL, update the stack with it:

```sh
npm.cmd run diff -- --context senderEmail=you@example.com --context frontendOrigin=https://ACTUAL_ID.execute-api.ap-south-1.amazonaws.com
npm.cmd run deploy -- --context senderEmail=you@example.com --context frontendOrigin=https://ACTUAL_ID.execute-api.ap-south-1.amazonaws.com
```

Keep that context on future deployments. Only direct browser uploads require this additional CORS setup. Local default origins are `http://localhost:8000` and `http://localhost:5173`; pass `--context extraOrigins=http://localhost:5173,http://localhost:8000` or your actual dev origin as needed. Do not use wildcard CORS or place credentials in `VITE_` variables. Private media images must be uploaded to the media bucket before importing S3 image references.

### SES and retained resources

Verify the real SES sender through AWS's email after provisioning. In the SES sandbox, verify recipients too or request production access in the deployment region. Cognito sends its own account verification/reset codes; SES here handles order confirmations.

Stateful construct IDs `StoreData`, `Media`, `Customers`, `Customers/Storefront`, `Sender`, `Notifications`, and `NotificationFailures` remain in place, as do table keys, TTL and stream format. Table, user pool and buckets use retention. The old `Catalogue`, `Auth`, `Customer` operation Lambdas and their routes are removed in favor of `StorefrontApp`; existing API consumers must migrate. Existing old browser token sessions are intentionally not imported: customers sign in again. Logs retain two weeks; failed notifications retain fourteen days. Email delivery is at-least-once and may duplicate after retries.

## Import actual products

Prepare your own JSON manifest with `products`, `categories` and optional `reviews`. From `backend/`:

```sh
npm.cmd run import:catalogue -- --file /path/to/your-catalogue.json --table TABLE_NAME_FROM_STACK_OUTPUT --region ap-south-1
```

The importer validates every record and all category/review links before writes. Duplicate IDs are rejected. Existing records are not overwritten unless you pass `--overwrite`. Use an operator profile with table writes; the storefront has no public catalogue administration functions. A new table is empty until imported.

- Product `id`, `slug`: letters, digits, `_`, `-`, up to 100 characters. `featured` and `price-range` remain reserved for importer compatibility.
- Product `name`, `category`, `categoryId`, `description`, `highlights` (string array), `specifications` (string-valued object), `tags` (string array): supply actual data.
- `images`: HTTPS URLs or `s3://YOUR_MEDIA_BUCKET/products/filename.jpg`; one to ten. The server generates expiring signed URLs.
- `price`, `originalPrice`: positive whole rupee amounts; original price at least the selling price. `stock`: nonnegative integer. `createdAt`: ISO datetime.
- Optional `rating`, `reviewCount`, `featured` default to `0`, `0`, `false`. Supply only real reviews/ratings.
- Categories: `id`, `slug`, `name`, `description`, `image`. Counts are derived from products.
- Reviews: `id`, `productId`, `author`, `rating` (1–5), `title`, `body`, `createdAt`.

For the explicitly requested historical **SAMPLE** catalogue migration, see [recovery, licensed photo credits and operator checklist](scripts/restore-catalogue.md). This is database content imported by an operator, never a runtime seed/fallback. `npm.cmd run restore:catalogue -- --ref HEAD` prepares ignored local manifests/photos without AWS calls. `npm.cmd run import:catalogue -- --file FILE --dry-run` validates schema/references without AWS calls. `publish:catalogue -- --expected-account ACCOUNT --apply` verifies/uploads private images before the conditional database import and consistent readback; omit `--apply` for read-only preflight.

Static photography in `public/images` remains presentation imagery, not product data or a fallback. There are no seeded users, products, orders or fake payment approvals. Checkout is COD only, recorded pending. Standard shipping is ₹199 (free above ₹20,000), express ₹499, tax 18%; change shared `src/domain/cartTotals.ts` for real store rules.

## Focused checks and operating limits

```sh
# repository root
bun run typecheck
bun run build
# backend/
npm.cmd run typecheck
npm.cmd run synth -- --context senderEmail=you@example.com
```

These are compile/build/synthesis checks only, not live AWS integration or deployment tests. On EC2, terminate TLS at Nginx and proxy to the Node server bound to localhost. Keep the site same-origin so cookies and CSRF checks remain in force. Public build assets are served locally; uploaded media remains private in S3.

Tradeoffs: the selected `t4g.micro` host has only 1 GiB RAM and may need a larger instance for sustained storefront traffic. Search currently reads and filters the catalogue partition; large catalogues need an index/pagination. Review alarms, backups and session-table access before launch.

Permissions use CDK resource grants: table read/write, media read and customer-prefix writes, asset read for the app; stream, SES identity and failure-queue grants for the worker. Cognito password/GetUser/refresh/revoke operations authorize via Cognito credentials/tokens, not IAM administrator privileges. No user-pool admin policy is granted. No deployment is implied by successful synthesis.
