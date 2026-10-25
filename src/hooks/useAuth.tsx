import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
<<<<<<< HEAD
import { toast } from "sonner";
import { authService } from "@/services";
import { authGeneration, beginAuthTransition, finishAuthTransition, isCurrentAuthGeneration } from "@/services/rpc";
=======
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authService } from "@/services";
import { mergeGuestData } from "@/services/shopping/mergeGuest";
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
<<<<<<< HEAD
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
=======
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ verificationRequired: boolean }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
<<<<<<< HEAD
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
=======
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
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
  const signOut = useCallback(async () => {
    const generation = beginAuthTransition();
    setUser(null);
<<<<<<< HEAD
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
=======
    queryClient.removeQueries({
      predicate: (query) => String(query.queryKey[0]).startsWith("admin-"),
    });
    await queryClient.invalidateQueries({ queryKey: ["runtime"] });
  }, [queryClient]);
  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refresh }),
    [user, loading, signIn, signUp, signOut, refresh],
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
<<<<<<< HEAD
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
=======
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
}
