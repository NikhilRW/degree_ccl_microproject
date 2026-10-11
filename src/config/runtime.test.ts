import { describe, expect, it } from "vitest";
import { assertRuntimeAvailable, parseRuntimeConfig } from "./runtime";

describe("runtime configuration", () => {
  it("defaults to demo with admin disabled", () => {
    expect(parseRuntimeConfig({})).toMatchObject({
      mode: "demo",
      demoAdmin: false,
      region: "ap-south-1",
    });
  });
  it("only enables admin explicitly", () => {
    expect(parseRuntimeConfig({ INTELLIMART_DEMO_ADMIN: "true" }).demoAdmin).toBe(true);
    expect(() => parseRuntimeConfig({ INTELLIMART_DEMO_ADMIN: "yes" })).toThrow(
      "INTELLIMART_DEMO_ADMIN",
    );
  });
  it("rejects invalid mode without echoing the value", () => {
    expect(() => parseRuntimeConfig({ INTELLIMART_MODE: "secret-value" })).toThrow(
      "Invalid application configuration: INTELLIMART_MODE",
    );
  });
  it("fails closed rather than using mocks in cloud mode", () => {
    expect(() => assertRuntimeAvailable(parseRuntimeConfig({ INTELLIMART_MODE: "cloud" }))).toThrow(
      "No mock fallback",
    );
    expect(() => assertRuntimeAvailable(parseRuntimeConfig({}))).not.toThrow();
  });
});
