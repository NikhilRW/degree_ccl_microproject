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
});
