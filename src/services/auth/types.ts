import type { Session, User } from "@/types";

export interface AuthService {
  signIn(email: string, password: string): Promise<Session>;
  signUp(name: string, email: string, password: string): Promise<void>;
  confirmSignUp(email: string, code: string): Promise<void>;
  resendConfirmationCode(email: string): Promise<void>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  getSession(): Promise<Session | null>;
  requestPasswordReset(email: string): Promise<void>;
  confirmPasswordReset(email: string, code: string, password: string): Promise<void>;
}
