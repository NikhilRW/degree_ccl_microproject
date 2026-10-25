# Restore the historical SAMPLE catalogue into AWS

This is an explicit operator migration, never a runtime fallback or automatic seed. It recovers the original **20 products, 8 categories, 80 generated SAMPLE reviews** from a trusted Git ref. Original names, descriptions, commercial specifications, prices, stock, dates, tags and historical rating/review-count aggregates are preserved. Aggregates are historical sample values, not counts of just the four review rows per product. Category counts are derived from the products. No users, sessions, carts or orders are recovered.

## Repeatable commands

From `backend/`, with dependencies installed and the intended AWS profile authenticated:

```sh
npm.cmd run restore:catalogue -- --ref 845a1eff193fec2ec43d809a02e5f229793a7afa
npm.cmd run import:catalogue -- --file .local/catalogue-restore/catalogue.json --dry-run
# Read-only account/privacy/hash/conflict checks:
npm.cmd run publish:catalogue -- --expected-account 535614566474
# AUTHORIZED AWS WRITES: upload/verify images first, then import catalogue:
npm.cmd run publish:catalogue -- --expected-account 535614566474 --apply
# Read-only source-to-cloud comparison, public catalogue RPCs and sample image GET:
npm.cmd run verify:catalogue:live
```

`restore:catalogue` makes no AWS calls. Only use trusted refs: it uses `git show`, esbuild to remove type-only alias imports, and a timeout-limited Node VM to evaluate the original object declarations/review generator. A VM is not a security boundary against hostile code. Deleted runtime mock files stay deleted. Bucket, table and region come from ignored `backend/outputs.json`; `--outputs PATH` or `--bucket BUCKET --region REGION` can select another destination. `--out DIRECTORY` changes the local output directory (default `backend/.local/catalogue-restore/`). No credentials are stored.

Ignored generated artifacts:
- `source-catalogue.json`: original import-schema-normalized records and original HTTPS URLs.
- `catalogue.json`: ready import records with private `s3://` references; `catalogue.draft.json` is an inspection copy.
- `images/<photo-id>.jpg`: deduplicated real JPEGs, maximum eight MiB each.
- `upload-manifest.json`: local paths, deterministic `catalogue/<photo-id>.jpg` keys, SHA-256, bytes, content type, cache control, provenance and S3 metadata.
- `readiness.json`: counts and documented image replacements. Only genuinely unresolved image/schema errors block readiness; SAMPLE content needs no additional approval.
- `cloud-verification.json`: publisher's upload counts, every object's size/encryption, and consistent DynamoDB readback counts.
- `live-verification.json`: public products/categories RPC counts and a sample product-image GET; no temporary signed URLs are logged or persisted. The same command adds source-to-cloud hashes, intentional differences, a stored S3-reference sample and conditional-write source excerpts to `cloud-verification.json`. It does not assert that client-useEffect product data appears in initial SSR HTML. Network/protocol probe limitations, if any, are reported explicitly alongside the independent direct-cloud evidence.

`publish:catalogue` requires the expected account, checks that all four S3 public-access blocks remain enabled, verifies local hashes, and preflights every intended DynamoDB key. It refuses different existing records/objects before writing. With `--apply`, it creates missing S3 objects conditionally (`If-None-Match: *`), without ACL/policy changes and using the bucket's default encryption. Every image is HEAD-verified before invoking the importer. Default importer writes are conditional; `--skip-identical` permits safe resume of an exact prior/partial import, never overwriting changed stock or unrelated data. The entire catalogue is not one atomic transaction; rerun the same publish command after resolving an operational failure. Do not use `--overwrite` blindly.

All content stays under the existing schema: products `CATALOG / PRODUCT#id`, categories `CATALOG / CATEGORY#id`, reviews `PRODUCT#productId / REVIEW#id`. No other partitions are written. The app generates fifteen-minute signed image URLs from the media bucket; images request private, five-minute browser caching. A dry-run checks data only, not the existence of objects in S3.

## Replacement photos and attribution

The original p09 primary returns 404 and its alternate depicts a keyboard. Both original p08 images depict other objects. These are replaced with **illustrative product-family photos, not purported photographs of an exact manufacturer/model**:

| Product | Photograph / author | Source | Licence |
| --- | --- | --- | --- |
| p08 laptop stand | “Laptop stand” — Solijon Solayev | [Commons file page](https://commons.wikimedia.org/wiki/File:Laptop_stand.jpg), [original JPEG](https://upload.wikimedia.org/wikipedia/commons/4/43/Laptop_stand.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| p09 USB-C hub | “USB-C Hubb 5 portar” — Khalid Bencherifa | [Commons file page](https://commons.wikimedia.org/wiki/File:USB-C_Hubb_5_portar.jpg), [original JPEG](https://upload.wikimedia.org/wikipedia/commons/7/76/USB-C_Hubb_5_portar.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

Both Commons original JPEGs are downloaded unchanged. Their photo-only CC BY-SA licence remains attached; modified versions must follow its share-alike requirements. Attribution, source and licence URLs are added to the respective product's **Photo credit** specification, visible in the existing product-details UI, and retained in S3 metadata/manifests. This does not relicense the application or assert photographer endorsement. All other original sample photographs retain their existing Unsplash provenance/licensing. Local copies are matched by exact photo ID, not guessed filenames. No dead original URL is published.

## AWS setup without AI

Use AWS CLI/CDK and the AWS console directly. Follow `backend/README.md`: authenticate your profile, install dependencies, build the root app, bootstrap CDK only for a new account/region, review `npm.cmd run diff -- --context senderEmail=YOUR_VERIFIED_EMAIL`, then `npm.cmd run deploy` with the same sender/origin context, and `npm.cmd run configure:local`. For this existing deployment, inspect CloudFormation outputs rather than recreating retained resources. Cognito manages real users, DynamoDB holds catalogue records, S3 holds private media, and SES requires sender verification (and sandbox recipient verification). Keep the actual storefront origin in media-upload CORS and credentials in your AWS profile/default provider chain, never frontend variables or Git. This data migration does not require an infrastructure redeploy.
