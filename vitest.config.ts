import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    clearMocks: true,
    // Bound Windows file-system/SDK load contention, without unbounded waits.
    maxWorkers: 2,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
