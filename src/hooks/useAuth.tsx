import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { authService } from "@/services";
import { authGeneration, beginAuthTransition, finishAuthTransition, isCurrentAuthGeneration } from "@/services/rpc";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const generation = authGeneration();
    const onSession = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const invalidatedGeneration: unknown = event.detail;
      if (active && typeof invalidatedGeneration === "number" && isCurrentAuthGeneration(invalidatedGeneration)) {
        setUser(null);
        setLoading(false);
      }
    };
    window.addEventListener("intellimart:signed-out", onSession);
    authService
      .getCurrentUser()
      .then((value) => {
        if (active && isCurrentAuthGeneration(generation)) setUser(value);
      })
      .catch((error) => {
        if (active && isCurrentAuthGeneration(generation))
          toast.error(error instanceof Error ? error.message : "Could not restore your session.");
      })
      .finally(() => {
        if (active && isCurrentAuthGeneration(generation)) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener("intellimart:signed-out", onSession);
    };
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    const generation = beginAuthTransition();
    setLoading(true);
    try {
      const session = await authService.signIn(email, password);
      if (finishAuthTransition(generation)) {
        setUser(session.user);
        setLoading(false);
      }
    } catch (error) {
      if (finishAuthTransition(generation)) setLoading(false);
      throw error;
    }
  }, []);
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    await authService.signUp(name, email, password);
  }, []);
  const signOut = useCallback(async () => {
    const generation = beginAuthTransition();
    setUser(null);
    setLoading(true);
    try {
      await authService.signOut();
    } catch (error) {
      if (isCurrentAuthGeneration(generation))
        toast.error(error instanceof Error ? error.message : "Could not revoke your session.");
    } finally {
      if (finishAuthTransition(generation)) setLoading(false);
    }
  }, []);
  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
