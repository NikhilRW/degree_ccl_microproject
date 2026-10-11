import type { Session, User } from "@/types";

export interface AuthService {
  signIn(email: string, password: string): Promise<Session>;
  signUp(name: string, email: string, password: string): Promise<{ verificationRequired: boolean }>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  getSession(): Promise<Session | null>;
  requestPasswordReset(email: string): Promise<void>;
}
