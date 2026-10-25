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

In **EC2 → Instances**, select `HH_EC2` (`i-0764e473e55dd19d7`) and start it. Before
running the app, attach an EC2 instance profile with the least-privilege policy
from the prior setup: access to the IntelliMart DynamoDB table and order index,
read access to the media bucket's `catalogue/*` and `products/*` keys, read/write
access to the `customers/*` upload keys, and
`cognito-idp:AdminListGroupsForUser` on the existing user pool. The app's Cognito
password/token calls use the public pool client and need no IAM permissions. Do
not grant permission to add Cognito users to groups, and never put developer
access keys on the server. In the EC2 console choose **Actions → Security → Modify
IAM role** to attach the instance profile. Optionally attach
`AmazonSSMManagedInstanceCore` as well if you want Session Manager access.

Allocate an Elastic IP under **EC2 → Network & Security → Elastic IP addresses**,
then associate it with `HH_EC2`. This stable IPv4 address is what the domain's DNS
record will use. Elastic IPs can incur charges; keep it associated while the
instance is in use.

The current instance is `t4g.micro` (1 GiB RAM) with an 8 GiB unencrypted root
volume. The production Node server may be memory constrained at this size; monitor
memory and disk and consider `t4g.small` before sustained traffic. The EC2
security group currently permits SSH from anywhere and HTTPS, but not HTTP. In
**EC2 → Security Groups → `HHSecureEC2` → Edit inbound rules**, restrict SSH (22)
to your current public IP, allow HTTP (80) for Let's Encrypt certificate
issuance/renewal, and keep HTTPS (443) open. Do not expose the Node port (3000).

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

Connect with `ssh -i "C:\path\to\ec2-login.pem" ec2-user@<ELASTIC_IP>`.

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

Edit the file as root and restrict access:

```sh
sudo nano /etc/intellimart.env
sudo chown root:root /etc/intellimart.env
sudo chmod 600 /etc/intellimart.env
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
it:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now intellimart
sudo systemctl status intellimart --no-pager
curl -I http://127.0.0.1:3000/
```

Configure Nginx to proxy HTTP/1.1 to `127.0.0.1:3000`, forwarding `Host`,
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

## 4. Cloudflare TLS, DNS and verification

You can use a Cloudflare Origin CA certificate on Nginx instead of Certbot. It is
trusted by Cloudflare, **not directly by browsers**; visitors get Cloudflare's
public edge certificate. Therefore the DNS record must be **Proxied** (orange
cloud), and Cloudflare SSL/TLS encryption mode must be **Full (strict)**. A direct
connection to the EC2 IP will not trust the Origin CA certificate.

In Cloudflare **SSL/TLS → Origin Server → Create Certificate**, issue a certificate
for `intellimart.nikhilwankhede.com`. Save the certificate and private key; keep
the private key secret. In Cloudflare **DNS → Records**, create/update:

| Name | Type | Content | Proxy |
| --- | --- | --- | --- |
| `intellimart` | A | The instance's Elastic IP | Proxied (orange cloud) |

Do not use the old API Gateway CNAME. In **SSL/TLS → Overview**, choose **Full
(strict)** and confirm the Cloudflare edge certificate (Universal SSL) is active.

On EC2, install the Cloudflare Origin certificate and private key:

```sh
sudo install -d -m 755 /etc/pki/tls/certs
sudo install -d -m 700 /etc/pki/tls/private
sudo nano /etc/pki/tls/certs/intellimart-origin.pem
sudo nano /etc/pki/tls/private/intellimart-origin.key
sudo chown root:root /etc/pki/tls/certs/intellimart-origin.pem /etc/pki/tls/private/intellimart-origin.key
sudo chmod 644 /etc/pki/tls/certs/intellimart-origin.pem
sudo chmod 600 /etc/pki/tls/private/intellimart-origin.key
```

Replace the Nginx server block with HTTP redirect plus an HTTPS proxy:

```nginx
server {
    listen 80;
    server_name intellimart.nikhilwankhede.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name intellimart.nikhilwankhede.com;
    ssl_certificate /etc/pki/tls/certs/intellimart-origin.pem;
    ssl_certificate_key /etc/pki/tls/private/intellimart-origin.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Validate/reload Nginx, wait for Cloudflare DNS/SSL to become active, then verify
the site, static assets, sign-in, product image reads/uploads, and admin RPCs. Sign
in again on the new hostname because `__Host-` cookies are hostname-specific.

Before testing browser image uploads, add `https://intellimart.nikhilwankhede.com`
to the media bucket's CORS allowed origins while preserving the existing API and
local-development origins. Keep allowed methods POST/GET/HEAD and allowed headers
`*`; do not make the bucket public.

Keep the current API Gateway deployment available at its existing URL while
verifying the custom hostname and EC2 application. From the repository root, first inspect
the CDK diff, then deploy the retained-resource configuration:

```powershell
npm.cmd --prefix backend run diff -- --context resourcesOnly=true --context frontendOrigin=https://intellimart.nikhilwankhede.com --context "extraOrigins=https://4u95ynchr3.execute-api.ap-south-1.amazonaws.com,http://localhost:8000,http://localhost:5173"
npm.cmd --prefix backend run deploy -- --context resourcesOnly=true --context frontendOrigin=https://intellimart.nikhilwankhede.com --context "extraOrigins=https://4u95ynchr3.execute-api.ap-south-1.amazonaws.com,http://localhost:8000,http://localhost:5173"
```

Confirm the diff deletes only `StorefrontApp`, `StoreApi`/stage and `WebAssets`;
all retained data resources and the independent order-email worker must remain.
Verify the stack outputs and site again after the change. Do not run this deploy
before the EC2 app and DNS cutover have been confirmed; it removes the old API
rollback path.
