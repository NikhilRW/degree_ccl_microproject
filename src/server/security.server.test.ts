import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSession, encryptSession } from "./session-crypto.server";

describe("session token encryption", () => {
  it("encrypts tokens and rejects tampering or a different key", () => {
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
});
