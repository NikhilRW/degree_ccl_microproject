import type { Session, User } from "@/types";
import { demoUser } from "@/data/users";
import { delay, readLocal, writeLocal } from "../serviceUtils";
import type { AuthService } from "./types";

const KEY = "intellimart.session";

/**
 * AWS LEARNING ZONE:
 * Replace this implementation with Amazon Cognito.
 *   - signIn / signUp  -> Cognito InitiateAuth / SignUp
 *   - getSession       -> Cognito refresh + ID/access tokens
 *   - requestPasswordReset -> Cognito ForgotPassword (email via Amazon SES)
 * Keep the AuthService interface identical so no UI changes are needed.
 */
export const mockAuthService: AuthService = {
  async signIn(email) {
    await delay();
    if (!email.includes("@")) throw new Error("Enter a valid email address.");
    const user: User = { ...demoUser, email, name: demoUser.name };
    const session: Session = { accessToken: `mock.${btoa(email)}`, expiresAt: Date.now() + 864e5, user };
    writeLocal(KEY, session);
    return session;
  },
  async signUp(name, email) {
    await delay();
    const user: User = { ...demoUser, id: `u_${Date.now()}`, name, email, addresses: [] };
    const session: Session = { accessToken: `mock.${btoa(email)}`, expiresAt: Date.now() + 864e5, user };
    writeLocal(KEY, session);
    return session;
  },
  async signOut() {
    await delay(120);
    writeLocal(KEY, null);
  },
  async getCurrentUser() {
    const s = readLocal<Session | null>(KEY, null);
    return s?.user ?? null;
  },
  async getSession() {
    return readLocal<Session | null>(KEY, null);
  },
  async requestPasswordReset(email) {
    await delay();
    if (!email.includes("@")) throw new Error("Enter a valid email address.");
  },
};

export const authService: AuthService = mockAuthService;
