import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyHmac(payload: string, signature: string, secret: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature) || !secret) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
