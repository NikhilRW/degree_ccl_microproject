import { assertRuntimeAvailable, parseRuntimeConfig } from "@/config/runtime";

export function getRuntimeConfig() {
  const config = parseRuntimeConfig(process.env);
  assertRuntimeAvailable(config);
  return config;
}

export function requireDemoAdmin() {
  const config = getRuntimeConfig();
  if (!config.demoAdmin) {
    throw new Error(
      "Demo administration is disabled. Set INTELLIMART_DEMO_ADMIN=true for a local, synthetic-data demonstration only.",
    );
  }
  // This is an explicit demo gate, NOT authentication. Cloud admin operations
  // must use verified Cognito identity and group checks in a future milestone.
}
