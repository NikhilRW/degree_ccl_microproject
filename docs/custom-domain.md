# IntelliMart custom domain on EC2

Use `intellimart.nikhilwankhede.com` as an A record pointing to the Elastic IP
associated with `HH_EC2`. DNS is hosted at Cloudflare (`amanda.ns.cloudflare.com`
and `finley.ns.cloudflare.com`). Set the A record to **Proxied** (orange cloud) so
visitors receive Cloudflare's public edge certificate.

On the instance, Nginx proxies HTTPS traffic to the Node server bound to
`127.0.0.1:3000`. Create a Cloudflare Origin CA certificate for Nginx and set
Cloudflare SSL/TLS mode to **Full (strict)**. The Origin CA certificate is trusted
by Cloudflare, not directly by browsers; visitors use Cloudflare's edge
certificate. See the [full EC2 deployment, Nginx, certificate, and DNS
runbook](ec2-deployment.md).

Before final cleanup, ensure the S3 media bucket CORS allows
`https://intellimart.nikhilwankhede.com` for browser POST/GET/HEAD requests. Preserve
the existing API origin until migration is complete. Then review and deploy the
CDK `resourcesOnly=true` diff as described in the runbook: it keeps DynamoDB,
Cognito, media storage, SES and the order-email worker while retiring the old
storefront Lambda, API Gateway and static-assets bucket.
