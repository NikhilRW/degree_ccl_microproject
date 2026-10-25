import { createServerFn } from "@tanstack/react-start";
import { confirmationSchema, emailSchema, loginSchema, resetSchema, signupSchema } from "../domain/contracts";
import * as auth from "../server/auth.server";
import { currentSession, signOut } from "../server/session.server";
import { rpc } from "../server/rpc.server";

// POST also for session reads: refreshing credentials is not a cacheable GET.
export const signInFn = createServerFn({ method: "POST" }).validator(loginSchema)
  .handler(({ data }) => rpc(() => auth.signIn(data)));
export const signUpFn = createServerFn({ method: "POST" }).validator(signupSchema)
  .handler(({ data }) => rpc(() => auth.signUp(data)));
export const confirmSignUpFn = createServerFn({ method: "POST" }).validator(confirmationSchema)
  .handler(({ data }) => rpc(() => auth.confirmSignUp(data)));
export const resendCodeFn = createServerFn({ method: "POST" }).validator(emailSchema)
  .handler(({ data }) => rpc(() => auth.resendCode(data)));
export const forgotPasswordFn = createServerFn({ method: "POST" }).validator(emailSchema)
  .handler(({ data }) => rpc(() => auth.forgotPassword(data)));
export const resetPasswordFn = createServerFn({ method: "POST" }).validator(resetSchema)
  .handler(({ data }) => rpc(() => auth.resetPassword(data)));
export const signOutFn = createServerFn({ method: "POST" }).handler(() => rpc(signOut));
export const sessionFn = createServerFn({ method: "POST" }).handler(() => rpc(currentSession));
