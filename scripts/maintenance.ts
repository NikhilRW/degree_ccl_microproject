import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { getRuntimeConfig } from "../src/server/runtime.server";
import { runMaintenance } from "../src/server/maintenance.server";

if (existsSync(".env")) loadEnvFile(".env");
if (getRuntimeConfig().mode !== "cloud")
  throw new Error(
    "Use the admin recovery button for the single-process file demo. The standalone worker is cloud-only.",
  );
await runMaintenance();
if (!process.argv.includes("--once")) {
  console.log(
    "Cloud recovery worker running every minute. The application also starts an in-process worker after its first request; transactions and leases protect retries.",
  );
  setInterval(() => {
    void runMaintenance().catch(() =>
      console.warn(JSON.stringify({ event: "maintenance.failed" })),
    );
  }, 60000);
}
