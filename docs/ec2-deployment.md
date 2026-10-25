# IntelliMart EC2 deployment runbook

The storefront now builds as a standard Nitro Node server (`bun run build`, then
`bun run start`). The selected host is the stopped Amazon Linux 2023 ARM instance
`i-0764e473e55dd19d7` (`HH_EC2`, `t4g.micro`). Its existing root volume and contents
must be preserved. Keep the current Lambda/API deployment live until the EC2 site
has been verified and the custom-domain cutover is complete.

## Services during and after migration

Keep DynamoDB, Cognito, the private media bucket, SES, and the DynamoDB Streams
order-email worker. The worker and its SQS failure queue are still used for order
confirmation delivery. After cutover, the EC2 storefront replaces the
`StorefrontApp` Lambda, `StoreApi` HTTP API, and `WebAssets` bucket. Remove only
those three resources through a reviewed CDK diff; keep the stream, notification
Lambda, failure queue, table, user pool, and media bucket.

## 1. Prepare the host

Start `HH_EC2` and associate an Elastic IP so DNS remains stable after stop/start.
The instance currently has no IAM instance profile. Attach a least-privilege EC2
role before starting IntelliMart; use temporary role credentials from the AWS SDK,
never copy developer access keys to the host. Required runtime access is to the
IntelliMart DynamoDB table, the media bucket (including customer/admin upload
prefixes), and `cognito-idp:AdminListGroupsForUser` for the existing user pool.
The app's Cognito password/token calls use the public pool client and do not need
IAM credentials. Do not grant the app permission to add users to Cognito groups.

The current instance is `t4g.micro` (1 GiB RAM) with an 8 GiB unencrypted root
volume. The production Node server may be memory constrained at this size; monitor
memory and disk and consider `t4g.small` before sustained traffic. The EC2
security group currently permits SSH from anywhere and HTTPS, but not HTTP. Restrict
SSH to the operator's IP, allow inbound 80 for ACME certificate issuance/renewal,
and keep 443 open. Do not expose the Node port (3000) publicly.

Install Node.js 22 and Nginx on Amazon Linux 2023, then create an application
directory and a dedicated unprivileged `intellimart` account:

```sh
sudo dnf install -y nodejs22 nginx unzip
node --version  # must report 22.x
sudo useradd --system --home-dir /opt/intellimart --shell /sbin/nologin intellimart
sudo install -d -o intellimart -g intellimart /opt/intellimart
```

## 2. Build and copy the app

From the repository root on the build machine:

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run build
Compress-Archive -Path .output\* -DestinationPath intellimart-output.zip -Force
scp -i "C:\path\to\ec2-login.pem" .\intellimart-output.zip ec2-user@<ELASTIC_IP>:/tmp/
```

On the instance, unpack the generated `.output` contents under `/opt/intellimart`
and set ownership to the dedicated service account. The build is bundled and runs
on ARM64; it does not require copying the Windows `node_modules` directory:

```sh
sudo unzip -o /tmp/intellimart-output.zip -d /opt/intellimart
sudo chown -R intellimart:intellimart /opt/intellimart
```

Create `/etc/intellimart.env` as root with mode `0600` and these values (use the
existing outputs in `backend/outputs.json`; do not put AWS keys in this file):

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
AWS_REGION=ap-south-1
TABLE_NAME=<existing TableName output>
MEDIA_BUCKET=<existing MediaBucket output>
COGNITO_CLIENT_ID=<existing UserPoolClientId output>
COGNITO_USER_POOL_ID=<existing UserPoolId output>
```

Do not set `ASSET_BUCKET`: the Nitro Node server serves its generated public
assets from `.output/public`. Product/customer uploads and private product images
continue to use the existing S3 media bucket.

## 3. Run as a service behind Nginx

Create `/etc/systemd/system/intellimart.service`:

```ini
[Unit]
Description=IntelliMart storefront
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=intellimart
Group=intellimart
WorkingDirectory=/opt/intellimart
EnvironmentFile=/etc/intellimart.env
ExecStart=/usr/bin/node /opt/intellimart/server/index.mjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Confirm Node's actual path with `command -v node` and adjust `ExecStart` if needed.
Enable/start the service and verify `curl -I http://127.0.0.1:3000/` before exposing
it. Configure Nginx to proxy HTTP/1.1 to `127.0.0.1:3000`, forwarding `Host`,
`X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`. Create
`/etc/nginx/conf.d/intellimart.conf`:

```nginx
server {
    listen 80;
    server_name intellimart.nikhilwankhede.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Keep the application port bound to localhost. Validate and enable Nginx with
`sudo nginx -t && sudo systemctl enable --now nginx`.

## 4. TLS, DNS and verification

For a single EC2 host, use a Let's Encrypt certificate on Nginx (ACM certificates
cannot be installed directly on EC2). Temporarily serve HTTP on port 80 for ACME
validation, then redirect HTTP to HTTPS. In Cloudflare, create an **A** record:

| Name | Type | Content | Proxy |
| --- | --- | --- | --- |
| `intellimart` | A | The instance's Elastic IP | DNS only (grey cloud) |

Do not use the current API Gateway CNAME target. After DNS resolves, issue the
certificate for `intellimart.nikhilwankhede.com` (for example, using Certbot's
Nginx integration), enable automatic renewal, then
verify the storefront, static assets, sign-in, product image reads/uploads, and
admin RPCs. Sign in again on the new hostname because `__Host-` cookies are
hostname-specific.

The current API Gateway URL remains the rollback path until the custom hostname
and EC2 application have been confirmed. From the repository root, first inspect
the CDK diff, then deploy the retained-resource configuration:

```powershell
npm.cmd --prefix backend run diff -- --context resourcesOnly=true
npm.cmd --prefix backend run deploy -- --context resourcesOnly=true
```

Confirm the diff deletes only `StorefrontApp`, `StoreApi`/stage and `WebAssets`;
all retained data resources and the independent order-email worker must remain.
Verify the stack outputs and site again after the change. Do not run this deploy
before the EC2 app and DNS cutover have been confirmed; it removes the old API
rollback path.
