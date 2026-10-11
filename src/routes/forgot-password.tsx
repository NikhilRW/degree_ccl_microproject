import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { completePasswordReset, requestPasswordReset } from "@/server/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — IntelliMart" }] }),
  component: ForgotPasswordPage,
});
function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
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
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="font-display text-3xl font-semibold">Reset your password</h1>
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
        </form>
      )}
    </div>
  );
}
