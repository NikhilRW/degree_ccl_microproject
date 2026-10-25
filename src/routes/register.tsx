import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — IntelliMart" },
      {
        name: "description",
        content:
          "Create an IntelliMart account to save products, track orders and check out faster.",
      },
      { property: "og:title", content: "Create account — IntelliMart" },
      { property: "og:description", content: "Join IntelliMart in a few seconds." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirming && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{10,}$/.test(password)) {
      toast.error("Use at least 10 characters with uppercase, lowercase, a number and a symbol.");
      return;
    }
    setBusy(true);
    try {
      if (confirming) {
        await authService.confirmSignUp(email, code);
        await signIn(email, password);
        void navigate({ to: "/account" });
      } else {
        await signUp(name, email, password);
        setConfirming(true);
        toast.success("Check your email for a verification code.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
<<<<<<< HEAD
      <h1 className="font-display text-3xl font-semibold">
        {confirming ? "Verify your email" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {confirming
          ? `Enter the verification code sent to ${email}.`
          : "Keep your orders, wishlist and favourite finds in one place."}
=======
      <h1 className="font-display text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cloud accounts use Cognito email verification. Demo accounts are simulated and must not use
        real passwords.
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
      </p>
      <form
        onSubmit={submit}
        className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6"
      >
<<<<<<< HEAD
        {!confirming && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
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
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              10+ characters, including uppercase, lowercase, a number and a symbol.
            </p>
          </>
        )}
        {confirming && (
          <div className="space-y-1.5">
            <Label htmlFor="confirmation-code">Verification code</Label>
            <Input
              id="confirmation-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              required
            />
          </div>
        )}
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : confirming ? "Verify and sign in" : "Create account"}
        </Button>
        {confirming && (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void authService
                .resendConfirmationCode(email)
                .then(() => toast.success("A new code has been sent."))
                .catch((error) =>
                  toast.error(
                    error instanceof Error ? error.message : "Could not resend the code.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            Resend code
          </Button>
        )}
=======
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
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
          {busy ? "Creating…" : "Create account"}
        </Button>
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
