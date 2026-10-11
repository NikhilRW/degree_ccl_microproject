import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer } from "node:net";

// Exercises the built Node runtime without writing to the demo data file.
if (!existsSync(".output/server/index.mjs"))
  throw new Error("Run npm run build before the production smoke test.");

const portProbe = createServer();
portProbe.listen(0, "127.0.0.1");
await once(portProbe, "listening");
const port = portProbe.address().port;
await new Promise((resolve, reject) =>
  portProbe.close((error) => (error ? reject(error) : resolve())),
);

const server = spawn(process.execPath, ["scripts/start.mjs"], {
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    INTELLIMART_MODE: "demo",
    INTELLIMART_DEMO_ADMIN: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let errors = "";
server.stderr.on("data", (data) => {
  errors += data;
});
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out. ${errors}`)), 15000);
    server.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited before startup (${code}). ${errors}`));
    });
    server.stdout.on("data", (data) => {
      if (String(data).includes("Listening on:")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.deepEqual(await health.json(), { status: "ok", application: "IntelliMart" });
  for (const [path, text] of [
    ["/", "IntelliMart"],
    ["/shop", "Shop all products"],
    ["/admin", "Demo administration is disabled"],
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
    const html = await response.text();
    assert.ok(html.includes(text), `${path} did not render expected content`);
  }
  assert.equal((await fetch(`${base}/favicon.svg`)).status, 200);
  console.log(
    "Production smoke passed: health, SSR, disabled admin, no-cache responses and static assets.",
  );
} finally {
  if (server.exitCode === null && server.signalCode === null) {
    const stopped = once(server, "exit");
    server.kill();
    await stopped;
  }
}

const cloud = spawn(process.execPath, ["scripts/start.mjs"], {
  // Deliberately incomplete even on a machine with a configured cloud .env;
  // this checks fail-closed validation, not a second live deployment.
  env: { ...process.env, INTELLIMART_MODE: "cloud", DYNAMODB_TABLE: "", SESSION_SECRET: "" },
  stdio: ["ignore", "ignore", "pipe"],
});
let cloudError = "";
cloud.stderr.on("data", (data) => {
  cloudError += data;
});
const [code] = await once(cloud, "exit");
assert.notEqual(code, 0);
assert.ok(cloudError.includes("Cloud configuration is incomplete"));
console.log("Cloud-mode startup correctly rejected; no mock fallback.");
