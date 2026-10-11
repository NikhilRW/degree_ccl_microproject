import { createHash, randomBytes } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import {
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  GlobalSignOutCommand,
  UpdateUserAttributesCommand,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { Session, User } from "@/types";
import { demoUser } from "@/data/users";
import { change, getRecords, retryConflict } from "./records.server";
import { getRuntimeConfig, requireDemoAdmin } from "./runtime.server";
import { getAwsClients } from "./clients.server";
import { decryptSession, encryptSession } from "./session-crypto.server";
import { queueWelcomeEmail } from "./notifications.server";

const COOKIE = "intellimart.session";
const demoKey = randomBytes(32);
const SESSION_SECONDS = 7 * 86400;
interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
interface StoredSession {
  userId: string;
  username: string;
  encrypted: string;
  expiresAt: number;
}
interface StoredProfile extends User {
  cognitoUsername?: string;
}
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;
const attempts = new Map<string, { count: number; until: number }>();

function throttle(identity: string) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
  const bucket = attempts.get(identity) ?? { count: 0, until: now + 60000 };
  bucket.count++;
  if (bucket.count > 10 || attempts.size > 10000)
    throw new Error("Too many authentication attempts. Try again in a minute.");
  attempts.set(identity, bucket);
}
function encryptionKey() {
  const secret = getRuntimeConfig().sessionSecret;
  return secret ? Buffer.from(secret, "base64") : demoKey;
}
function cookieOptions() {
  return {
    httpOnly: true,
    secure: getRuntimeConfig().appUrl.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_SECONDS,
  };
}
function tokenVerifier() {
  const config = getRuntimeConfig();
  return (verifier ??= CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    clientId: config.clientId,
    tokenUse: "access",
  }));
}
export async function isCognitoAdmin(username: string): Promise<boolean> {
  const config = getRuntimeConfig();
  let token: string | undefined;
  do {
    const result = await getAwsClients().cognito.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: config.userPoolId,
        Username: username,
        ...(token ? { NextToken: token } : {}),
      }),
    );
    if (result.Groups?.some((group) => group.GroupName === config.adminGroup)) return true;
    token = result.NextToken;
  } while (token);
  return false;
}
function publicProfile(profile: StoredProfile, admin: boolean): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    createdAt: profile.createdAt,
    addresses: profile.addresses,
    isAdmin: admin,
    disabled: profile.disabled ?? false,
  };
}
async function establish(user: User, username: string, tokens: Tokens): Promise<Session> {
  const token = randomBytes(32).toString("base64url");
  const sessionId = createHash("sha256").update(token).digest("hex");
  const expiresAt = Date.now() + SESSION_SECONDS * 1000;
  await getRecords().transaction([
    {
      kind: "SESSION",
      id: sessionId,
      expected: null,
      value: {
        userId: user.id,
        username,
        encrypted: encryptSession(
          tokens,
          encryptionKey(),
          JSON.stringify([sessionId, user.id, username, expiresAt]),
        ),
        expiresAt,
      } satisfies StoredSession,
    },
  ]);
  setCookie(COOKIE, token, cookieOptions());
  return { user, expiresAt };
}

export async function signIn(email: string, password: string): Promise<Session> {
  throttle(`login:${email}`);
  const config = getRuntimeConfig();
  if (config.mode === "demo") {
    const id =
      email === demoUser.email
        ? demoUser.id
        : `demo_${createHash("sha256").update(email).digest("hex").slice(0, 20)}`;
    const existing = await getRecords().get<User>("PROFILE", id);
    const user: User = existing?.value ?? { ...demoUser, id, email, addresses: [] };
    if (user.disabled) throw new Error("This account is disabled.");
    if (!existing)
      await getRecords().transaction([change("PROFILE", id, null, { ...user, isAdmin: false })]);
    return establish({ ...user, isAdmin: config.demoAdmin }, email, {
      accessToken: "demo",
      refreshToken: "",
      expiresAt: Date.now() + 86400000,
    });
  }
  let result;
  try {
    result = await getAwsClients().cognito.send(
      new InitiateAuthCommand({
        ClientId: config.clientId,
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "UserNotConfirmedException")
      throw new Error(
        "Verify your email before signing in. Use the verification page to request a new code.",
      );
    throw new Error("Sign-in failed. Check your credentials and account verification.");
  }
  if (result.ChallengeName)
    throw new Error(
      `Cognito requires ${result.ChallengeName}. Complete any administrator temporary-password setup in Cognito before using this app; MFA challenges are not supported by this lab login.`,
    );
  const auth = result.AuthenticationResult;
  if (!auth?.AccessToken || !auth.RefreshToken)
    throw new Error("Cognito did not return a complete session.");
  const payload = await tokenVerifier().verify(auth.AccessToken);
  const username = payload["username"];
  if (typeof username !== "string") throw new Error("Invalid Cognito access token.");
  const remote = await getAwsClients().cognito.send(
    new AdminGetUserCommand({ UserPoolId: config.userPoolId, Username: username }),
  );
  if (!remote.Enabled) throw new Error("This account is disabled.");
  const attrs = Object.fromEntries(
    (remote.UserAttributes ?? []).map((attribute) => [attribute.Name!, attribute.Value ?? ""]),
  );
  const id = payload.sub;
  const existing = await getRecords().get<StoredProfile>("PROFILE", id);
  const profile: StoredProfile = {
    id,
    email: attrs["email"] ?? email,
    name: attrs["name"] ?? email.split("@")[0]!,
    addresses: existing?.value.addresses ?? [],
    createdAt:
      existing?.value.createdAt ?? remote.UserCreateDate?.toISOString() ?? new Date().toISOString(),
    cognitoUsername: username,
  };
  await retryConflict(async () => {
    const row = await getRecords().get<StoredProfile>("PROFILE", id);
    await getRecords().transaction([
      change("PROFILE", id, row, {
        ...profile,
        addresses: row?.value.addresses ?? profile.addresses,
      }),
    ]);
  });
  if (!existing) await queueWelcomeEmail(profile);
  return establish(publicProfile(profile, await isCognitoAdmin(username)), username, {
    accessToken: auth.AccessToken,
    refreshToken: auth.RefreshToken,
    expiresAt: Date.now() + (auth.ExpiresIn ?? 3600) * 1000,
  });
}

async function sessionContext() {
  const cookieToken = getCookie(COOKIE);
  if (!cookieToken || !/^[A-Za-z0-9_-]{43}$/.test(cookieToken)) return null;
  // Store only a digest of the bearer cookie. A table read must not reveal a
  // reusable session credential. Encryption is bound to this row and identity.
  const token = createHash("sha256").update(cookieToken).digest("hex");
  const row = await getRecords().get<StoredSession>("SESSION", token);
  if (!row || row.value.expiresAt <= Date.now()) {
    deleteCookie(COOKIE, cookieOptions());
    return null;
  }
  const config = getRuntimeConfig();
  let tokens: Tokens;
  try {
    tokens = decryptSession<Tokens>(
      row.value.encrypted,
      encryptionKey(),
      JSON.stringify([token, row.value.userId, row.value.username, row.value.expiresAt]),
    );
  } catch {
    deleteCookie(COOKIE, cookieOptions());
    return null;
  }
  let admin = config.demoAdmin;
  if (config.mode === "cloud") {
    if (tokens.expiresAt <= Date.now() + 60000) {
      try {
        const refreshed = await getAwsClients().cognito.send(
          new InitiateAuthCommand({
            ClientId: config.clientId,
            AuthFlow: "REFRESH_TOKEN_AUTH",
            AuthParameters: { REFRESH_TOKEN: tokens.refreshToken },
          }),
        );
        if (!refreshed.AuthenticationResult?.AccessToken)
          throw new Error("Missing refreshed token");
        tokens = {
          ...tokens,
          accessToken: refreshed.AuthenticationResult.AccessToken,
          expiresAt: Date.now() + (refreshed.AuthenticationResult.ExpiresIn ?? 3600) * 1000,
        };
        await tokenVerifier().verify(tokens.accessToken);
        try {
          await getRecords().transaction([
            change("SESSION", token, row, {
              ...row.value,
              encrypted: encryptSession(
                tokens,
                encryptionKey(),
                JSON.stringify([token, row.value.userId, row.value.username, row.value.expiresAt]),
              ),
            }),
          ]);
        } catch {
          /* Another request may have refreshed the same session; ownership is still verified below. */
        }
      } catch {
        deleteCookie(COOKIE, cookieOptions());
        return null;
      }
    }
    const payload = await tokenVerifier().verify(tokens.accessToken);
    if (payload.sub !== row.value.userId) throw new Error("Invalid session identity.");
    try {
      // Local JWT verification alone cannot detect Cognito token revocation.
      // GetUser validates the token with Cognito, including global sign-out/reset.
      const tokenUser = await getAwsClients().cognito.send(
        new GetUserCommand({ AccessToken: tokens.accessToken }),
      );
      const subject = tokenUser.UserAttributes?.find(
        (attribute) => attribute.Name === "sub",
      )?.Value;
      if (subject !== row.value.userId) throw new Error("Invalid Cognito session identity.");
      const remote = await getAwsClients().cognito.send(
        new AdminGetUserCommand({ UserPoolId: config.userPoolId, Username: row.value.username }),
      );
      if (!remote.Enabled) {
        deleteCookie(COOKIE, cookieOptions());
        return null;
      }
    } catch (error) {
      if (
        error instanceof Error &&
        ["UserNotFoundException", "NotAuthorizedException"].includes(error.name)
      ) {
        deleteCookie(COOKIE, cookieOptions());
        return null;
      }
      throw error;
    }
    // Live group check prevents stale token claims granting revoked admin access.
    admin = await isCognitoAdmin(row.value.username);
  }
  const profile = await getRecords().get<StoredProfile>("PROFILE", row.value.userId);
  if (!profile || profile.value.disabled) return null;
  return { token, row, tokens, user: publicProfile(profile.value, admin) };
}
export async function getCurrentSession(): Promise<Session | null> {
  const context = await sessionContext();
  return context ? { user: context.user, expiresAt: context.row.value.expiresAt } : null;
}
export async function requireUser(): Promise<User> {
  const session = await getCurrentSession();
  if (!session) throw new Error("Sign in to continue.");
  return session.user;
}
export async function requireAdmin(): Promise<User> {
  if (getRuntimeConfig().mode === "demo") {
    requireDemoAdmin();
    return { ...demoUser, id: "demo-operator", isAdmin: true };
  }
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("Administrator permission is required.");
  return user;
}
export async function signOut() {
  const context = await sessionContext();
  deleteCookie(COOKIE, cookieOptions());
  if (!context) return;
  await retryConflict(async () => {
    const row = await getRecords().get("SESSION", context.token);
    if (row) await getRecords().transaction([change("SESSION", context.token, row, null)]);
  });
  if (getRuntimeConfig().mode === "cloud") {
    try {
      await getAwsClients().cognito.send(
        new GlobalSignOutCommand({ AccessToken: context.tokens.accessToken }),
      );
    } catch {
      /* The local opaque session is already revoked. */
    }
  }
}
export async function register(name: string, email: string, password: string) {
  throttle(`register:${email}`);
  const config = getRuntimeConfig();
  if (config.mode === "demo") {
    const session = await signIn(email, password);
    const row = await getRecords().get<User>("PROFILE", session.user.id);
    await getRecords().transaction([
      change("PROFILE", session.user.id, row, { ...session.user, name, isAdmin: false }),
    ]);
    return { verificationRequired: false };
  }
  await getAwsClients().cognito.send(
    new SignUpCommand({
      ClientId: config.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "name", Value: name },
      ],
    }),
  );
  return { verificationRequired: true };
}
export async function confirmRegistration(email: string, code: string) {
  throttle(`verify:${email}`);
  if (getRuntimeConfig().mode === "cloud")
    await getAwsClients().cognito.send(
      new ConfirmSignUpCommand({
        ClientId: getRuntimeConfig().clientId,
        Username: email,
        ConfirmationCode: code,
      }),
    );
}
export async function resendRegistration(email: string) {
  throttle(`verify:${email}`);
  if (getRuntimeConfig().mode === "cloud")
    await getAwsClients().cognito.send(
      new ResendConfirmationCodeCommand({ ClientId: getRuntimeConfig().clientId, Username: email }),
    );
}
export async function forgotPassword(email: string) {
  throttle(`reset:${email}`);
  if (getRuntimeConfig().mode === "cloud") {
    try {
      await getAwsClients().cognito.send(
        new ForgotPasswordCommand({ ClientId: getRuntimeConfig().clientId, Username: email }),
      );
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !["UserNotFoundException", "InvalidParameterException"].includes(error.name)
      )
        throw error;
    }
  }
}
export async function resetPassword(email: string, code: string, password: string) {
  throttle(`reset:${email}`);
  if (getRuntimeConfig().mode === "cloud")
    await getAwsClients().cognito.send(
      new ConfirmForgotPasswordCommand({
        ClientId: getRuntimeConfig().clientId,
        Username: email,
        ConfirmationCode: code,
        Password: password,
      }),
    );
}
export async function updateProfile(input: {
  name: string;
  addresses: User["addresses"];
}): Promise<User> {
  const context = await sessionContext();
  if (!context) throw new Error("Sign in to continue.");
  if (getRuntimeConfig().mode === "cloud")
    await getAwsClients().cognito.send(
      new UpdateUserAttributesCommand({
        AccessToken: context.tokens.accessToken,
        UserAttributes: [{ Name: "name", Value: input.name }],
      }),
    );
  return retryConflict(async () => {
    const row = await getRecords().get<StoredProfile>("PROFILE", context.user.id);
    if (!row) throw new Error("Profile not found.");
    const value = { ...row.value, ...input };
    await getRecords().transaction([change("PROFILE", context.user.id, row, value)]);
    return publicProfile(value, context.user.isAdmin ?? false);
  });
}
