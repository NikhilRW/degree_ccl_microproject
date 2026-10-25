import { z } from "zod";

export const runtimeEnvKeys = [
  "INTELLIMART_MODE",
  "INTELLIMART_DEMO_ADMIN",
  "INTELLIMART_DEMO_DATA_FILE",
  "INTELLIMART_DATA_FILE",
  "AWS_REGION",
  "APP_URL",
  "DYNAMODB_TABLE",
  "COGNITO_USER_POOL_ID",
  "COGNITO_CLIENT_ID",
  "COGNITO_ADMIN_GROUP",
  "SESSION_SECRET",
  "S3_MEDIA_BUCKET",
  "MEDIA_BASE_URL",
  "SES_FROM_EMAIL",
] as const;

const optional = z.string().trim().default("");
const schema = z.object({
  INTELLIMART_MODE: z.enum(["demo", "cloud"]).default("demo"),
  INTELLIMART_DEMO_ADMIN: z.enum(["true", "false"]).default("false"),
  INTELLIMART_DEMO_DATA_FILE: z.string().trim().min(1).default(".data/catalogue.json"),
  INTELLIMART_DATA_FILE: z.string().trim().min(1).default(".data/application.json"),
  AWS_REGION: z.string().trim().min(1).default("ap-south-1"),
  APP_URL: z.string().url().default("http://127.0.0.1:3000"),
  DYNAMODB_TABLE: optional,
  COGNITO_USER_POOL_ID: optional,
  COGNITO_CLIENT_ID: optional,
  COGNITO_ADMIN_GROUP: z.string().trim().min(1).default("admin"),
  SESSION_SECRET: optional,
  S3_MEDIA_BUCKET: optional,
  MEDIA_BASE_URL: optional,
  SES_FROM_EMAIL: optional,
});

export function parseRuntimeConfig(env: Record<string, string | undefined>) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Invalid application configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  const data = parsed.data;
  return {
    mode: data.INTELLIMART_MODE,
    demoAdmin: data.INTELLIMART_DEMO_ADMIN === "true",
    demoDataFile: data.INTELLIMART_DEMO_DATA_FILE,
    dataFile: data.INTELLIMART_DATA_FILE,
    region: data.AWS_REGION,
    appUrl: new URL(data.APP_URL).origin,
    table: data.DYNAMODB_TABLE,
    userPoolId: data.COGNITO_USER_POOL_ID,
    clientId: data.COGNITO_CLIENT_ID,
    adminGroup: data.COGNITO_ADMIN_GROUP,
    sessionSecret: data.SESSION_SECRET,
    mediaBucket: data.S3_MEDIA_BUCKET,
    mediaBaseUrl: data.MEDIA_BASE_URL.replace(/\/$/, ""),
    emailFrom: data.SES_FROM_EMAIL,
  };
}

export type RuntimeConfig = ReturnType<typeof parseRuntimeConfig>;

export function assertRuntimeAvailable(config: RuntimeConfig) {
  if (
    config.sessionSecret &&
    (!/^[A-Za-z0-9+/]{43}=$/.test(config.sessionSecret) ||
      Buffer.from(config.sessionSecret, "base64").length !== 32)
  )
    throw new Error("SESSION_SECRET must be a base64-encoded 32-byte random key.");
  if (config.mode !== "cloud") return;
  const missing = [
    ["DYNAMODB_TABLE", config.table],
    ["COGNITO_USER_POOL_ID", config.userPoolId],
    ["COGNITO_CLIENT_ID", config.clientId],
    ["SESSION_SECRET", config.sessionSecret],
    ["S3_MEDIA_BUCKET", config.mediaBucket],
    ["MEDIA_BASE_URL", config.mediaBaseUrl],
    ["SES_FROM_EMAIL", config.emailFrom],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length)
    throw new Error(
      `Cloud configuration is incomplete: ${missing.join(", ")}. No mock fallback is permitted.`,
    );
  if (!config.userPoolId.startsWith(`${config.region}_`))
    throw new Error("COGNITO_USER_POOL_ID must belong to AWS_REGION.");
  if (!z.string().email().safeParse(config.emailFrom).success)
    throw new Error("SES_FROM_EMAIL must be a verified email address.");
  const application = new URL(config.appUrl);
  if (
    application.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(application.hostname)
  )
    throw new Error("Cloud APP_URL requires HTTPS, except for local development.");
  if (
    !z.string().url().safeParse(config.mediaBaseUrl).success ||
    !config.mediaBaseUrl.startsWith("https://")
  )
    throw new Error("MEDIA_BASE_URL must be an HTTPS CloudFront asset URL.");
}
