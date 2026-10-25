import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outputs = JSON.parse(
  await readFile(path.join(root, "backend/outputs.json"), "utf8"),
) as Record<string, Record<string, string>>;
const stack = outputs.IntelliMartBackend;
const names = { TABLE_NAME: "TableName", MEDIA_BUCKET: "MediaBucket", COGNITO_CLIENT_ID: "UserPoolClientId",
  COGNITO_USER_POOL_ID: "UserPoolId", AWS_REGION: "Region" };
const values = Object.entries(names).map(([key, output]) => {
  const value = stack?.[output];
  if (!value || !/^[a-zA-Z0-9_./:-]+$/.test(value)) throw new Error(`Missing/invalid stack output ${output}. Provision resources first.`);
  return `${key}=${value}`;
});
const filename = path.join(root, ".env.local");
let existing = "";
try {
  existing = await readFile(filename, "utf8");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const replaced = new Set([...Object.keys(names), "VITE_API_URL"]);
const lines = existing.split(/\r?\n/).filter(line => !replaced.has(line.split("=")[0].trim()));
await writeFile(filename, `${[...lines.filter(Boolean), ...values].join("\n")}\n`);
console.log("Updated root .env.local with server-only AWS resource settings. Restart bun run dev. Use your normal AWS credentials/profile.");
