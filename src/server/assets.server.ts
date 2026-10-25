import "@tanstack/react-start/server-only";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./aws.server";

// The AWS Lambda Nitro preset emits public files separately. HTTP API is the
// single browser origin, so serve the deployed asset bucket through this entry.
// Vite handles public assets itself during local development.
export async function staticAsset(request: Request): Promise<Response | undefined> {
  const bucket = process.env["ASSET_BUCKET"];
  if (!bucket || !["GET", "HEAD"].includes(request.method)) return undefined;
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/assets/") && !path.startsWith("/images/") &&
      !["/favicon.ico", "/favicon.svg", "/robots.txt"].includes(path)) return undefined;
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: decodeURIComponent(path.slice(1)) }));
    const headers = new Headers({
      "Content-Type": result.ContentType ?? "application/octet-stream",
      "Cache-Control": path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    if (result.ETag) headers.set("ETag", result.ETag);
    // Drain the SDK stream even for HEAD; do not leak pooled connections.
    const bytes = await result.Body?.transformToByteArray();
    return new Response(request.method === "HEAD" || !bytes ? null : new Uint8Array(bytes).buffer, { headers });
  } catch (error) {
    if (error instanceof Error && ["NoSuchKey", "NotFound"].includes(error.name)) return new Response("Not found", { status: 404 });
    throw error;
  }
}
