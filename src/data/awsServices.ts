import type { AwsServiceEntry } from "@/types";

/** Code readiness is separate from verified AWS deployment status. */
export const awsServices: AwsServiceEntry[] = [
  {
    id: "ec2",
    name: "Amazon EC2",
    category: "Compute",
    purpose: "Hosts the Node application, SSR, server functions and recovery worker.",
    location: "scripts/start.mjs / deploy/intellimart.service",
    tasks: [
      "Create an instance with an IAM role",
      "Build on Linux",
      "Configure HTTPS origin access and a restartable service",
    ],
    docsUrl: "https://docs.aws.amazon.com/ec2/",
  },
  {
    id: "cognito",
    name: "Amazon Cognito",
    category: "Identity",
    purpose:
      "Verified login/reset flows, encrypted server-side sessions and live customer/admin checks.",
    location: "src/server/auth.server.ts",
    tasks: [
      "Create an email user pool and app client without a secret",
      "Enable password and refresh-token flows",
      "Create the admin group and verify a test account",
    ],
    docsUrl: "https://docs.aws.amazon.com/cognito/",
  },
  {
    id: "dynamodb",
    name: "Amazon DynamoDB",
    category: "Database",
    purpose:
      "Persists catalogue, shopping data, profiles, orders, sessions and audits with conditional transactions.",
    location: "src/server/records.server.ts",
    tasks: [
      "Create one PK/SK table",
      "Enable expiresAt TTL",
      "Run the non-destructive seed command",
    ],
    docsUrl: "https://docs.aws.amazon.com/dynamodb/",
  },
  {
    id: "s3",
    name: "Amazon S3",
    category: "Storage",
    purpose: "Private image storage with bounded signed uploads and server-validated publishing.",
    location: "src/server/media.server.ts",
    tasks: [
      "Create a private bucket and upload CORS",
      "Keep uploads/pending private",
      "Allow CloudFront OAC to read media/* only",
    ],
    docsUrl: "https://docs.aws.amazon.com/s3/",
  },
  {
    id: "cloudfront",
    name: "Amazon CloudFront",
    category: "Delivery",
    purpose: "Serves EC2 dynamic traffic and cached S3 media through a global HTTPS endpoint.",
    location: "docs/AWS_SETUP.md",
    tasks: [
      "Configure EC2 and S3 origins",
      "Forward cookies, Origin and required headers",
      "Disable caching for auth, server functions and webhooks",
    ],
    docsUrl: "https://docs.aws.amazon.com/cloudfront/",
  },
  {
    id: "ses",
    name: "Amazon SES",
    category: "Email",
    purpose:
      "Welcome, confirmation and shipping emails with durable retry state; demo delivery is simulated.",
    location: "src/server/notifications.server.ts",
    tasks: [
      "Verify sender and sandbox recipients",
      "Grant SendEmail permissions",
      "Exercise email failure/retry without undoing orders",
    ],
    docsUrl: "https://docs.aws.amazon.com/ses/",
  },
  {
    id: "secrets-manager",
    name: "AWS Secrets Manager",
    category: "Security",
    purpose: "Server-only Razorpay test keys and webhook signing secrets; live keys are rejected.",
    location: "src/server/razorpay.server.ts",
    tasks: [
      "Store keyId/keySecret/webhookSecret JSON",
      "Grant the EC2 role access",
      "Configure test-mode capture and webhook delivery",
    ],
    docsUrl: "https://docs.aws.amazon.com/secretsmanager/",
  },
  {
    id: "iam",
    name: "AWS IAM",
    category: "Permissions",
    purpose: "Resource-scoped EC2 permissions through the standard AWS credential chain.",
    location: "deploy/iam-policy.example.json",
    tasks: [
      "Replace resource placeholders",
      "Attach an EC2 instance profile",
      "Keep operator credentials out of the app/browser",
    ],
    docsUrl: "https://docs.aws.amazon.com/IAM/",
  },
  {
    id: "cloudwatch",
    name: "Amazon CloudWatch",
    category: "Monitoring",
    purpose: "Operational logs and EC2 metrics using the provided agent configuration.",
    location: "deploy/cloudwatch-agent.example.json",
    tasks: [
      "Install/configure the agent",
      "Set retention and selected alarms",
      "Verify logs after a controlled failure",
    ],
    docsUrl: "https://docs.aws.amazon.com/cloudwatch/",
  },
].map((entry) => ({ ...entry, status: "code-ready", difficulty: "Intermediate" }));
