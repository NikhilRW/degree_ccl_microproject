import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services";
import { ServiceError } from "@/services/rpc";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: "/admin" } =>
    search["redirect"] === "/admin" ? { redirect: "/admin" } : {},
  head: () => ({
    meta: [
      { title: "Sign in — IntelliMart" },
      {
        name: "description",
        content: "Sign in to IntelliMart to track orders, save a wishlist and check out faster.",
      },
      { property: "og:title", content: "Sign in — IntelliMart" },
      { property: "og:description", content: "Access your IntelliMart account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (confirming) await authService.confirmSignUp(email, code);
      await signIn(email, password);
      void navigate({ to: redirect ?? "/account" });
    } catch (err) {
      if (err instanceof ServiceError && err.code === "UserNotConfirmedException") {
        setConfirming(true);
        void authService
          .resendConfirmationCode(email)
          .catch((error) =>
            toast.error(
              error instanceof Error ? error.message : "Could not send verification code.",
            ),
          );
      }
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to view your orders and revisit your favourite finds.
      </p>
      <form
        onSubmit={submit}
        className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Link to="/verify-email" search={{ email }} className="block text-sm text-primary">
          Verify your email / resend code
        </Link>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {confirming && (
          <div className="space-y-1.5">
            <Label htmlFor="verify-code">Email verification code</Label>
            <Input
              id="verify-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              required
            />
            <p className="text-sm text-muted-foreground">
              Check your email to verify your account before signing in.
            </p>
          </div>
        )}
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : confirming ? "Verify and sign in" : "Sign in"}
        </Button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground">
            Forgot password?
          </Link>
          <Link to="/register" className="font-medium text-primary">
            Create account
          </Link>
        </div>
      </form>
    </div>
  );
}
