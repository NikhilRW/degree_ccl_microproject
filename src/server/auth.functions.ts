import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import * as auth from "./auth.server";
import { emailSchema, profileSchema } from "./validation";

const password = z.string().min(8).max(128);
const emailInput = z.object({ email: emailSchema }).strict();
const codeInput = z
  .object({
    email: emailSchema,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the six-digit code"),
  })
  .strict();
export const currentSession = createServerFn({ method: "GET" }).handler(() =>
  auth.getCurrentSession(),
);
export const signInUser = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({ email: emailSchema, password: z.string().min(1).max(128) })
      .strict()
      .parse(raw),
  )
  .handler(({ data }) => auth.signIn(data.email, data.password));
export const registerUser = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({ name: z.string().trim().min(2).max(100), email: emailSchema, password })
      .strict()
      .parse(raw),
  )
  .handler(({ data }) => auth.register(data.name, data.email, data.password));
export const signOutUser = createServerFn({ method: "POST" }).handler(() => auth.signOut());
export const confirmUser = createServerFn({ method: "POST" })
  .validator((raw: unknown) => codeInput.parse(raw))
  .handler(({ data }) => auth.confirmRegistration(data.email, data.code));
export const resendUserCode = createServerFn({ method: "POST" })
  .validator((raw: unknown) => emailInput.parse(raw))
  .handler(({ data }) => auth.resendRegistration(data.email));
export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((raw: unknown) => emailInput.parse(raw))
  .handler(({ data }) => auth.forgotPassword(data.email));
export const completePasswordReset = createServerFn({ method: "POST" })
  .validator((raw: unknown) => codeInput.extend({ password }).parse(raw))
  .handler(({ data }) => auth.resetPassword(data.email, data.code, data.password));
export const saveProfile = createServerFn({ method: "POST" })
  .validator((raw: unknown) => profileSchema.parse(raw))
  .handler(({ data }) => auth.updateProfile(data));
