import type { AuthService } from "./types";
import { confirmSignUpFn, forgotPasswordFn, resendCodeFn, resetPasswordFn, sessionFn, signInFn, signOutFn, signUpFn } from "@/functions/auth.functions";
import { unwrap } from "../rpc";

export const authService: AuthService = {
  signIn: (email, password) => unwrap(() => signInFn({ data: { email, password } }), false),
  async signUp(name, email, password) { await unwrap(() => signUpFn({ data: { name, email, password } }), false); },
  async confirmSignUp(email, code) { await unwrap(() => confirmSignUpFn({ data: { email, code } }), false); },
  async resendConfirmationCode(email) { await unwrap(() => resendCodeFn({ data: { email } }), false); },
  async signOut() { await unwrap(() => signOutFn(), false); },
  async getCurrentUser() { return (await unwrap(() => sessionFn()))?.user ?? null; },
  getSession: () => unwrap(() => sessionFn()),
  async requestPasswordReset(email) { await unwrap(() => forgotPasswordFn({ data: { email } }), false); },
  async confirmPasswordReset(email, code, password) { await unwrap(() => resetPasswordFn({ data: { email, code, password } }), false); },
};
