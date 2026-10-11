import { createFileRoute } from "@tanstack/react-router";
import { getRuntimeConfig } from "@/server/runtime.server";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: () => {
        getRuntimeConfig();
        return Response.json(
          { status: "ok", application: "IntelliMart" },
          {
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
