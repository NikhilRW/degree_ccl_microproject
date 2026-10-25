import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { z } from "zod";
import { getRuntimeConfig } from "./runtime.server";
import { getAwsClients } from "./clients.server";

const secretSchema = z.object({
  keyId: z.string().startsWith("rzp_test_"),
  keySecret: z.string().min(10),
  webhookSecret: z.string().min(16),
});
let cached: { at: number; value: z.infer<typeof secretSchema> } | undefined;
export async function getPaymentSecrets() {
  const config = getRuntimeConfig();
  if (config.mode !== "cloud")
    throw new Error("Razorpay is available only in configured cloud mode.");
  if (cached && cached.at > Date.now() - 300000) return cached.value;
  let raw: unknown;
  if (config.razorpaySecretId) {
    const result = await getAwsClients().secrets.send(
      new GetSecretValueCommand({ SecretId: config.razorpaySecretId }),
    );
    if (!result.SecretString)
      throw new Error("Razorpay Secrets Manager value must be a JSON string.");
    try {
      raw = JSON.parse(result.SecretString);
    } catch {
      throw new Error("Razorpay secret must contain valid JSON; its value has not been printed.");
    }
  } else
    raw = {
      keyId: config.razorpayKeyId,
      keySecret: config.razorpayKeySecret,
      webhookSecret: config.razorpayWebhookSecret,
    };
  const parsed = secretSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(
      "Invalid Razorpay test secret configuration. Expected keyId, keySecret and webhookSecret; live keys are rejected.",
    );
  cached = { at: Date.now(), value: parsed.data };
  return parsed.data;
}

export async function razorpay<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const keys = await getPaymentSecrets();
  if (!path.startsWith("/") || path.includes("..")) throw new Error("Invalid payment resource.");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keys.keyId}:${keys.keySecret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      `Payment provider request failed (${response.status}). Retry or reconcile this order; it has not been marked paid by this response.`,
    );
  return response.json() as Promise<T>;
}
export interface ProviderPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  amount_refunded?: number;
}
export interface ProviderOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
}
export interface ProviderRefund {
  id: string;
  amount: number;
  status: string;
  receipt?: string;
}
