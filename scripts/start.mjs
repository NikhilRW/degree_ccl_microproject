import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { tsImport } from "tsx/esm/api";

if (existsSync(".env")) loadEnvFile(".env");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12))
  throw new Error("IntelliMart requires Node.js 22.12 or newer.");
const { parseRuntimeConfig, assertRuntimeAvailable } = await tsImport(
  "../src/config/runtime.ts",
  import.meta.url,
);
assertRuntimeAvailable(parseRuntimeConfig(process.env));
if (!existsSync(".output/server/index.mjs")) throw new Error("Run npm run build first.");
process.env.HOST ??= "127.0.0.1";
process.env.PORT ??= "3000";
await import("../.output/server/index.mjs");
