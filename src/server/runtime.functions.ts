import { createServerFn } from "@tanstack/react-start";
import { getRuntimeConfig } from "./runtime.server";
import { getCurrentSession } from "./auth.server";

export const getRuntimeInfo = createServerFn({ method: "GET" }).handler(async () => {
  const config = getRuntimeConfig();
  const session = await getCurrentSession();
  return {
    mode: config.mode,
    demoAdmin: config.mode === "demo" && config.demoAdmin,
    adminAccess: config.mode === "demo" ? config.demoAdmin : !!session?.user.isAdmin,
    authenticated: !!session,
  };
});
