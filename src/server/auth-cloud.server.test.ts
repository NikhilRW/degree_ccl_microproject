import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Records } from "./records.server";

const state = vi.hoisted(() => ({
  records: null as Records | null,
  cookies: new Map<string, string>(),
  enabled: true,
  admin: true,
  verify: vi.fn(async () => ({ sub: "cloud-sub", username: "cloud-user" })),
  send: vi.fn(),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (name: string) => state.cookies.get(name),
  setCookie: (name: string, value: string) => state.cookies.set(name, value),
  deleteCookie: (name: string) => state.cookies.delete(name),
}));
vi.mock("./records.server", async (original) => ({
  ...(await original<typeof import("./records.server")>()),
  getRecords: () => state.records!,
}));
vi.mock("./clients.server", () => ({ getAwsClients: () => ({ cognito: { send: state.send } }) }));
vi.mock("./notifications.server", () => ({ queueWelcomeEmail: vi.fn(async () => undefined) }));
vi.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: { create: () => ({ verify: state.verify }) },
}));
import { createFileRecords } from "./records.server";
import { signIn, getCurrentSession, requireAdmin, requireUser, signOut } from "./auth.server";

let directory: string;
beforeEach(async () => {
  const parent = join(tmpdir(), "opencode");
  await mkdir(parent, { recursive: true });
  directory = await mkdtemp(join(parent, "intellimart-auth-"));
  state.records = createFileRecords(join(directory, "records.json"), async () => []);
  state.cookies.clear();
  state.enabled = true;
  state.admin = true;
  state.verify.mockReset();
  state.verify.mockResolvedValue({ sub: "cloud-sub", username: "cloud-user" });
  const config: Record<string, string> = {
    INTELLIMART_MODE: "cloud",
    APP_URL: "https://lab.example.com",
    AWS_REGION: "ap-south-1",
    DYNAMODB_TABLE: "test",
    COGNITO_USER_POOL_ID: "ap-south-1_testpool",
    COGNITO_CLIENT_ID: "client",
    COGNITO_ADMIN_GROUP: "admin",
    SESSION_SECRET: Buffer.alloc(32, 8).toString("base64"),
    S3_MEDIA_BUCKET: "media",
    MEDIA_BASE_URL: "https://media.example.com",
    SES_FROM_EMAIL: "sender@example.com",
    RAZORPAY_SECRET_ID: "secret-id",
  };
  Object.entries(config).forEach(([name, value]) => vi.stubEnv(name, value));
  state.send.mockReset();
  state.send.mockImplementation(async (command: { constructor: { name: string } }) => {
    switch (command.constructor.name) {
      case "InitiateAuthCommand":
        return {
          AuthenticationResult: {
            AccessToken: "sensitive-access-token",
            RefreshToken: "sensitive-refresh-token",
            ExpiresIn: 3600,
          },
        };
      case "AdminGetUserCommand":
        return {
          Enabled: state.enabled,
          UserAttributes: [
            { Name: "email", Value: "cloud@example.com" },
            { Name: "name", Value: "Cloud Customer" },
          ],
        };
      case "GetUserCommand":
        return { UserAttributes: [{ Name: "sub", Value: "cloud-sub" }] };
      case "AdminListGroupsForUserCommand":
        return { Groups: state.admin ? [{ GroupName: "admin" }] : [] };
      case "GlobalSignOutCommand":
        return {};
      default:
        throw new Error("Unexpected test command");
    }
  });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe("cloud identity boundaries with mocked Cognito", () => {
  it("keeps real identity tokens off the client and encrypted in persisted sessions", async () => {
    const session = await signIn("cloud@example.com", "test-password");
    expect(session.user.id).toBe("cloud-sub");
    expect(session.user.isAdmin).toBe(true);
    expect(JSON.stringify(session)).not.toContain("sensitive-");
    const persisted = await state.records!.list<{ encrypted: string }>("SESSION");
    expect(persisted).toHaveLength(1);
    expect(JSON.stringify(persisted)).not.toContain("sensitive-");
    expect([...state.cookies.values()][0]).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(persisted[0]?.id).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted[0]?.id).not.toBe([...state.cookies.values()][0]);
  });
  it("checks current admin-group membership instead of trusting old token/UI claims", async () => {
    await signIn("cloud@example.com", "test-password");
    expect((await requireAdmin()).isAdmin).toBe(true);
    state.admin = false;
    await expect(requireAdmin()).rejects.toThrow("Administrator permission");
    expect((await requireUser()).isAdmin).toBe(false);
  });
  it("denies disabled accounts immediately and revokes the local session on logout", async () => {
    await signIn("cloud@example.com", "test-password");
    state.enabled = false;
    expect(await getCurrentSession()).toBeNull();
    await expect(requireUser()).rejects.toThrow("Sign in");
    state.enabled = true;
    await signIn("cloud@example.com", "test-password");
    await signOut();
    expect(state.cookies.size).toBe(0);
    expect(await getCurrentSession()).toBeNull();
  });
  it("does not accept an invalid identity token", async () => {
    state.verify.mockRejectedValueOnce(new Error("Invalid token signature"));
    await expect(signIn("cloud@example.com", "test-password")).rejects.toThrow(
      "Invalid token signature",
    );
    expect(state.cookies.size).toBe(0);
  });
  it("rejects a Cognito-revoked token even when its JWT signature and expiry still validate", async () => {
    await signIn("cloud@example.com", "test-password");
    state.send.mockRejectedValue(
      Object.assign(new Error("Token revoked"), { name: "NotAuthorizedException" }),
    );
    expect(await getCurrentSession()).toBeNull();
    expect(state.cookies.size).toBe(0);
  });
});
