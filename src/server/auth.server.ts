import "@tanstack/react-start/server-only";
import {
  ConfirmForgotPasswordCommand, ConfirmSignUpCommand, ForgotPasswordCommand,
  InitiateAuthCommand, ResendConfirmationCodeCommand, SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { z } from "zod";
import { clientId, cognito, HttpError } from "./aws.server";
import { createSession } from "./session.server";
import type { loginSchema, signupSchema, emailSchema, confirmationSchema, resetSchema } from "../domain/contracts";

export async function signIn(input: z.infer<typeof loginSchema>) {
  const result = await cognito.send(new InitiateAuthCommand({
    ClientId: clientId, AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: input.email, PASSWORD: input.password },
  }));
  const tokens = result.AuthenticationResult;
  if (!tokens?.AccessToken || !tokens.RefreshToken) throw new HttpError(400,
    "Your account requires an additional sign-in step. Contact the store administrator.",
    result.ChallengeName ?? "AUTH_CHALLENGE");
  return createSession(tokens.AccessToken, tokens.RefreshToken, tokens.ExpiresIn ?? 1800);
}
export async function signUp(input: z.infer<typeof signupSchema>) {
  await cognito.send(new SignUpCommand({ ClientId: clientId, Username: input.email, Password: input.password,
    UserAttributes: [{ Name: "email", Value: input.email }, { Name: "name", Value: input.name }] }));
  return { confirmationRequired: true };
}
export async function confirmSignUp(input: z.infer<typeof confirmationSchema>) {
  await cognito.send(new ConfirmSignUpCommand({ ClientId: clientId, Username: input.email, ConfirmationCode: input.code }));
  return { confirmed: true };
}
export async function resendCode(input: z.infer<typeof emailSchema>) {
  await cognito.send(new ResendConfirmationCodeCommand({ ClientId: clientId, Username: input.email }));
  return { sent: true };
}
export async function forgotPassword(input: z.infer<typeof emailSchema>) {
  await cognito.send(new ForgotPasswordCommand({ ClientId: clientId, Username: input.email }));
  return { sent: true };
}
export async function resetPassword(input: z.infer<typeof resetSchema>) {
  await cognito.send(new ConfirmForgotPasswordCommand({ ClientId: clientId, Username: input.email,
    ConfirmationCode: input.code, Password: input.password }));
  return { reset: true };
}
