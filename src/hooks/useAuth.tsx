import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authService } from "@/services";
import { mergeGuestData } from "@/services/shopping/mergeGuest";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ verificationRequired: boolean }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const merge = useCallback(async () => {
    try {
      await mergeGuestData();
    } catch {
      toast.error(
        "Guest cart merge failed. Your guest data is still saved locally; retry sign-in.",
      );
    }
  }, []);
  const refresh = useCallback(async () => {
    const session = await authService.getSession();
    if (session) await merge();
    setUser(session?.user ?? null);
    await queryClient.invalidateQueries({ queryKey: ["runtime"] });
  }, [queryClient, merge]);
  useEffect(() => {
    refresh()
      .catch(() => toast.error("Could not load your session"))
      .finally(() => setLoading(false));
  }, [refresh]);
  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await authService.signIn(email, password);
      await merge();
      setUser(session.user);
      await queryClient.invalidateQueries({ queryKey: ["runtime"] });
    },
    [merge, queryClient],
  );
  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const result = await authService.signUp(name, email, password);
      if (!result.verificationRequired) await refresh();
      return result;
    },
    [refresh],
  );
  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    queryClient.removeQueries({
      predicate: (query) => String(query.queryKey[0]).startsWith("admin-"),
    });
    await queryClient.invalidateQueries({ queryKey: ["runtime"] });
  }, [queryClient]);
  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refresh }),
    [user, loading, signIn, signUp, signOut, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
