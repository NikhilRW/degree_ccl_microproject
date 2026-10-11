import {
  currentSession,
  registerUser,
  requestPasswordReset,
  signInUser,
  signOutUser,
} from "@/server/auth.functions";
import type { AuthService } from "./types";

export const authService: AuthService = {
  signIn: (email, password) => signInUser({ data: { email, password } }),
  signUp: (name, email, password) => registerUser({ data: { name, email, password } }),
  signOut: () => signOutUser(),
  getSession: () => currentSession(),
  async getCurrentUser() {
    return (await currentSession())?.user ?? null;
  },
  requestPasswordReset: (email) => requestPasswordReset({ data: { email } }),
};
