import { createFileRoute, Link } from "@tanstack/react-router";
<<<<<<< HEAD
import { useState } from "react";
import { toast } from "sonner";
=======
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { completePasswordReset, requestPasswordReset } from "@/server/auth.functions";
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services";

export const Route = createFileRoute("/forgot-password")({
<<<<<<< HEAD
  head: () => ({
    meta: [
      { title: "Reset password — IntelliMart" },
      { name: "description", content: "Reset your IntelliMart account password." },
    ],
  }),
  component: ForgotPasswordPage,
});
function ForgotPasswordPage() {
  const [stage, setStage] = useState<"email" | "code" | "done">("email");
=======
  head: () => ({ meta: [{ title: "Reset password — IntelliMart" }] }),
  component: ForgotPasswordPage,
});
function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
<<<<<<< HEAD
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (stage === "email") {
        await authService.requestPasswordReset(email);
        setStage("code");
      } else {
        await authService.confirmPasswordReset(email, code, password);
        setStage("done");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset your password.");
=======
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (!sent) {
        await requestPasswordReset({ data: { email } });
        setSent(true);
      } else {
        await completePasswordReset({ data: { email, code, password } });
        setDone(true);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reset failed");
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="font-display text-3xl font-semibold">Reset your password</h1>
<<<<<<< HEAD
      <p className="mt-3 text-sm">
        {stage === "code"
          ? "Enter the code from your email and choose a new password."
          : stage === "done"
            ? "Your password has been updated."
            : "Enter your account email to receive a reset code."}
      </p>
      {stage === "done" ? (
        <Button asChild className="mt-8">
          <Link to="/login">Back to sign in</Link>
        </Button>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5 bg-card p-6">
          {stage === "email" ? (
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="reset-code">Verification code</Label>
                <Input
                  id="reset-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={10}
                  autoComplete="new-password"
                  required
                />
                <p className="text-sm text-muted-foreground">
                  10+ characters with uppercase, lowercase, a number and a symbol.
                </p>
              </div>
            </>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : stage === "email" ? "Send reset code" : "Reset password"}
          </Button>
=======
      {done ? (
        <p className="mt-6">
          Password reset completed.{" "}
          <Link to="/login" className="text-primary">
            Sign in
          </Link>
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border p-6">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {sent && (
            <>
              <p className="text-sm text-muted-foreground">
                If the account is eligible, Cognito sends a reset code. Demo mode simulates this
                operation; use 000000.
              </p>
              <Label htmlFor="reset-code">Six-digit code</Label>
              <Input
                id="reset-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </>
          )}
          <Button type="submit" disabled={busy}>
            {sent ? "Reset password" : "Request reset code"}
          </Button>
          <Link to="/login" className="block text-sm text-primary">
            Back to sign in
          </Link>
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
        </form>
      )}
    </div>
  );
}
