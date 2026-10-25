import "@tanstack/react-start/server-only";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { HttpError, type RpcResult } from "../domain/contracts";
import type { Session, User } from "../types";

export function authenticated<T>(
  session: RpcResult<Session>,
  fn: (user: User) => Promise<T>,
): Promise<RpcResult<T>> {
  return rpc(async () => {
    if (!session.ok)
      throw new HttpError(session.error.status, session.error.message, session.error.code);
    return fn(session.value.user);
  });
}

export async function rpc<T>(fn: () => Promise<T>): Promise<RpcResult<T>> {
  setResponseHeader("Cache-Control", "private, no-store");
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof HttpError)
      return {
        ok: false,
        error: {
          status: error.status,
          code: error.code,
          message: error.message,
        },
      };
    if (error instanceof z.ZodError)
      return {
        ok: false,
        error: {
          status: 400,
          code: "VALIDATION_ERROR",
          message: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        },
      };
    const name = error instanceof Error ? error.name : "UnknownError";
    if (
      ["NotAuthorizedException", "UserNotFoundException", "RefreshTokenReuseException"].includes(
        name,
      )
    )
      return {
        ok: false,
        error: { status: 401, code: name, message: "Your sign-in details or session are invalid." },
      };
    if (
      [
        "UsernameExistsException",
        "UserNotConfirmedException",
        "CodeMismatchException",
        "ExpiredCodeException",
        "InvalidPasswordException",
        "InvalidParameterException",
      ].includes(name)
    )
      return {
        ok: false,
        error: {
          status: 400,
          code: name,
          message: error instanceof Error ? error.message : "Check your details.",
        },
      };
    if (["TooManyRequestsException", "LimitExceededException"].includes(name))
      return {
        ok: false,
        error: { status: 429, code: name, message: "Too many requests. Please try again shortly." },
      };
    if (["TransactionCanceledException", "ConditionalCheckFailedException"].includes(name))
      return {
        ok: false,
        error: {
          status: 409,
          code: "CONFLICT",
          message: "The item changed or stock is no longer available. Refresh and try again.",
        },
      };
    // Never log SDK request objects: they can contain passwords or tokens.
    console.error("Store operation failed", name);
    return {
      ok: false,
      error: {
        status: 500,
        code: "INTERNAL_ERROR",
        message: "The request could not be completed. Please try again.",
      },
    };
  }
}
