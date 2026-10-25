import "@tanstack/react-start/server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DeleteCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { GetTokensFromRefreshTokenCommand, RevokeTokenCommand } from "@aws-sdk/client-cognito-identity-provider";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import type { Session, User } from "../types";
import { clientId, cognito, db, getItem, getUser, HttpError, table } from "./aws.server";

const secure = process.env["NODE_ENV"] === "production";
const cookieName = secure ? "__Host-intellimart" : "intellimart";
const cookieOptions = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
const lifetime = 7 * 86400;
interface StoredSession {
  pk: string; sk: "SESSION"; accessToken: string; refreshToken: string;
  accessExpiresAt: number; expiresAt: number; user: User; version: number;
  refreshLock?: string; lockUntil?: number;
}
function sessionKey() {
  const value = getCookie(cookieName);
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) return undefined;
  return `SESSION#${createHash("sha256").update(value).digest("hex")}`;
}
const publicSession = (row: StoredSession): Session => ({ user: row.user, expiresAt: row.expiresAt * 1000 });
const conditionalFailure = (error: unknown) => error instanceof Error && error.name === "ConditionalCheckFailedException";
async function revoke(token: string) {
  try {
    await cognito.send(new RevokeTokenCommand({ ClientId: clientId, Token: token }));
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "NotAuthorizedException") throw error;
  }
}

export async function signOut() {
  const pk = sessionKey();
  // Deletion is unconditional: a racing refresher must not recreate this row.
  // Delete first; clear the cookie even if Cognito revocation is unavailable.
  try {
    if (pk) {
      const result = await db.send(new DeleteCommand({
        TableName: table, Key: { pk, sk: "SESSION" }, ReturnValues: "ALL_OLD",
      }));
      const token: unknown = result.Attributes?.["refreshToken"];
      if (typeof token === "string") await revoke(token);
    }
  } finally {
    deleteCookie(cookieName, cookieOptions);
  }
  return { signedOut: true };
}

export async function createSession(accessToken: string, refreshToken: string, expiresIn: number): Promise<Session> {
  const user = await getUser(accessToken); // Cognito verifies the access token and verified email.
  await signOut();
  const opaqueId = randomBytes(32).toString("base64url");
  const pk = `SESSION#${createHash("sha256").update(opaqueId).digest("hex")}`;
  const row: StoredSession = {
    pk, sk: "SESSION", accessToken, refreshToken, user, version: 1,
    accessExpiresAt: Date.now() + expiresIn * 1000,
    expiresAt: Math.floor(Date.now() / 1000) + lifetime,
  };
  await db.send(new PutCommand({ TableName: table, Item: row, ConditionExpression: "attribute_not_exists(pk)" }));
  setCookie(cookieName, opaqueId, { ...cookieOptions, maxAge: lifetime });
  return publicSession(row);
}

export async function currentSession(): Promise<Session | null> {
  const pk = sessionKey();
  if (!pk) return null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const row = await getItem<StoredSession>(pk, "SESSION");
    if (!row || row.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    if (row.accessExpiresAt > Date.now() + 60_000) return publicSession(row);
    if (row.lockUntil && row.lockUntil > Date.now()) {
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    const lock = randomUUID();
    try {
      await db.send(new UpdateCommand({
        TableName: table, Key: { pk, sk: "SESSION" },
        UpdateExpression: "SET refreshLock = :lock, lockUntil = :until",
        ConditionExpression: "attribute_exists(pk) AND #version = :version AND expiresAt > :now AND (attribute_not_exists(lockUntil) OR lockUntil < :ms)",
        ExpressionAttributeNames: { "#version": "version" },
        ExpressionAttributeValues: {
          ":lock": lock, ":until": Date.now() + 15_000, ":version": row.version,
          ":now": Math.floor(Date.now() / 1000), ":ms": Date.now(),
        },
      }));
    } catch (error) {
      if (conditionalFailure(error)) continue;
      throw error;
    }
    let rotatedToken: string | undefined;
    try {
      const result = await cognito.send(new GetTokensFromRefreshTokenCommand({
        ClientId: clientId, RefreshToken: row.refreshToken,
      }));
      const tokens = result.AuthenticationResult;
      if (!tokens?.AccessToken) throw new HttpError(401, "Your session expired. Sign in again.", "UNAUTHORIZED");
      rotatedToken = tokens.RefreshToken ?? row.refreshToken;
      const user = await getUser(tokens.AccessToken);
      if (user.id !== row.user.id) throw new HttpError(401, "Invalid session identity.", "UNAUTHORIZED");
      const updated = await db.send(new UpdateCommand({
        TableName: table, Key: { pk, sk: "SESSION" },
        UpdateExpression: "SET accessToken = :access, refreshToken = :refresh, accessExpiresAt = :expiry, #user = :user, #version = :next REMOVE refreshLock, lockUntil",
        ConditionExpression: "attribute_exists(pk) AND refreshLock = :lock AND #version = :version AND expiresAt > :now",
        ExpressionAttributeNames: { "#user": "user", "#version": "version" },
        ExpressionAttributeValues: {
          ":access": tokens.AccessToken, ":refresh": rotatedToken,
          ":expiry": Date.now() + (tokens.ExpiresIn ?? 1800) * 1000, ":user": user,
          ":next": row.version + 1, ":version": row.version, ":lock": lock,
          ":now": Math.floor(Date.now() / 1000),
        }, ReturnValues: "ALL_NEW",
      }));
      // No Set-Cookie during refresh: late responses cannot restore a signed-out cookie.
      return publicSession(updated.Attributes as unknown as StoredSession);
    } catch (error) {
      if (conditionalFailure(error)) {
        const winner = await getItem<StoredSession>(pk, "SESSION");
        if (!winner) {
          if (rotatedToken) await revoke(rotatedToken);
          return null;
        }
        continue; // Another lock holder won; load its tokens, never overwrite them.
      }
      const invalid = error instanceof HttpError && error.status === 401 ||
        error instanceof Error && ["NotAuthorizedException", "UserNotFoundException", "RefreshTokenReuseException"].includes(error.name);
      try {
        if (invalid) {
          await db.send(new DeleteCommand({ TableName: table, Key: { pk, sk: "SESSION" },
            ConditionExpression: "refreshLock = :lock", ExpressionAttributeValues: { ":lock": lock } }));
        } else {
          await db.send(new UpdateCommand({ TableName: table, Key: { pk, sk: "SESSION" },
            UpdateExpression: "REMOVE refreshLock, lockUntil", ConditionExpression: "refreshLock = :lock",
            ExpressionAttributeValues: { ":lock": lock } }));
        }
      } catch (releaseError) {
        if (!conditionalFailure(releaseError)) throw releaseError;
      }
      if (invalid) return null;
      throw error;
    }
  }
  throw new HttpError(503, "Session refresh is busy. Please try again shortly.", "SESSION_BUSY");
}
export async function requireSession(): Promise<Session> {
  const session = await currentSession();
  if (!session) throw new HttpError(401, "Sign in to continue.", "UNAUTHORIZED");
  return session;
}
