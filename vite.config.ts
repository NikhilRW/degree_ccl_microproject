<<<<<<< HEAD
// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Only populate Node's environment. Never define these values in browser bundles.
const serverEnv = loadEnv(process.env["NODE_ENV"] === "production" ? "production" : "development", process.cwd(), "");
for (const key of ["TABLE_NAME", "MEDIA_BUCKET", "COGNITO_CLIENT_ID", "COGNITO_USER_POOL_ID", "AWS_REGION", "AWS_PROFILE"]) {
  if (!process.env[key] && serverEnv[key]) process.env[key] = serverEnv[key];
}

export default defineConfig({
  nitro: { preset: "node-server" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
=======
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import {
  assertRuntimeAvailable,
  parseRuntimeConfig,
  runtimeEnvKeys,
} from "./src/config/runtime.ts";

export default defineConfig(({ command, mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), "");
  assertRuntimeAvailable(parseRuntimeConfig({ ...localEnv, ...process.env }));
  // Vite exposes only VITE_* automatically. Copy this small server-only allowlist
  // so .env also configures server functions during local development.
  for (const key of runtimeEnvKeys) {
    if (process.env[key] === undefined && localEnv[key] !== undefined)
      process.env[key] = localEnv[key];
  }

  return {
    plugins: [
      tailwindcss(),
      tanstackStart({
        server: { entry: "server" },
        importProtection: { behavior: "error", client: { files: ["**/*.server.*"] } },
      }),
      ...(command === "build" ? [nitro({ preset: "node-server" })] : []),
      react(),
    ],
    server: { host: "127.0.0.1", port: 3000, strictPort: true },
    resolve: { tsconfigPaths: true, dedupe: ["react", "react-dom", "@tanstack/react-router"] },
  };
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
});
