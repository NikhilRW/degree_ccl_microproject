import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getRuntimeInfo } from "@/server/runtime.functions";

export const Route = createFileRoute("/login")({
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
  loader: () => getRuntimeInfo(),
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const runtime = Route.useLoaderData();
  const [email, setEmail] = useState(runtime.mode === "demo" ? "demo@intellimart.dev" : "");
  const [password, setPassword] = useState(runtime.mode === "demo" ? "demo1234" : "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
      void navigate({ to: "/account" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <h1 className="font-display text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {runtime.mode === "demo"
          ? "Demo mode accepts any valid email and a nonempty password. Use synthetic data only."
          : "Sign in with your verified Cognito account. Your session is kept in a secure server-managed cookie."}
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
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
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
