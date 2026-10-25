import { afterEach, describe, expect, it, vi } from "vitest";
import { requireDemoAdmin } from "./runtime.server";

afterEach(() => vi.unstubAllEnvs());
describe("server-side demo admin gate", () => {
  it("rejects requests when admin is disabled", () => {
    vi.stubEnv("INTELLIMART_MODE", "demo");
    vi.stubEnv("INTELLIMART_DEMO_ADMIN", "false");
    expect(() => requireDemoAdmin()).toThrow("disabled");
  });
  it("allows only explicit demo enablement and rejects cloud fallback", () => {
    vi.stubEnv("INTELLIMART_MODE", "demo");
    vi.stubEnv("INTELLIMART_DEMO_ADMIN", "true");
    expect(() => requireDemoAdmin()).not.toThrow();
    vi.stubEnv("INTELLIMART_MODE", "cloud");
    expect(() => requireDemoAdmin()).toThrow("Cloud configuration is incomplete");
  });
});
