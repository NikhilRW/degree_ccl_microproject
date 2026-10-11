import { createHmac, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { encryptSession, decryptSession } from "./session-crypto.server";
import { verifyHmac } from "./payment-security";
import { isImageSignature } from "./media.server";
import { calculateTotals, toPaise } from "./pricing";
import { products } from "@/data/products";

describe("cryptography and payment money", () => {
  it("encrypts session tokens and rejects tampering or a different key", () => {
    const key = randomBytes(32);
    const value = {
      accessToken: "sensitive-access-token",
      refreshToken: "sensitive-refresh-token",
    };
    const encoded = encryptSession(value, key);
    expect(encoded).not.toContain(value.accessToken);
    expect(decryptSession(encoded, key)).toEqual(value);
    const bytes = Buffer.from(encoded, "base64url");
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    expect(() => decryptSession(bytes.toString("base64url"), key)).toThrow();
    expect(() => decryptSession(encoded, randomBytes(32))).toThrow();
    const bound = encryptSession(value, key, "session-A|user-A");
    expect(() => decryptSession(bound, key, "session-B|user-A")).toThrow();
  });
  it("rejects malformed, wrong and changed HMAC signatures", () => {
    const signature = createHmac("sha256", "secret").update("order|payment").digest("hex");
    expect(verifyHmac("order|payment", signature, "secret")).toBe(true);
    expect(verifyHmac("tampered", signature, "secret")).toBe(false);
    expect(verifyHmac("order|payment", "invalid", "secret")).toBe(false);
  });
  it("checks image bytes rather than trusting a MIME label", () => {
    expect(isImageSignature(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png")).toBe(
      true,
    );
    expect(isImageSignature(Buffer.from("<script>alert(1)</script>"), "image/png")).toBe(false);
    expect(isImageSignature(Buffer.from([255, 216, 255]), "image/jpeg")).toBe(true);
    expect(isImageSignature(Buffer.from("<svg></svg>"), "image/svg+xml")).toBe(false);
  });
  it("uses integer paise and does not subtract a sale discount twice", () => {
    expect(toPaise(0.29)).toBe(29);
    expect(() => toPaise(1.001)).toThrow();
    const product = { ...products[0]!, price: 99.99, originalPrice: 149.99 };
    const totals = calculateTotals({
      items: [{ productId: product.id, quantity: 3, product }],
      updatedAt: "",
    });
    expect(totals.subtotal).toBe(299.97);
    expect(totals.discount).toBe(150);
    expect(totals.tax).toBe(53.99);
    expect(totals.total).toBe(552.96);
  });
});
