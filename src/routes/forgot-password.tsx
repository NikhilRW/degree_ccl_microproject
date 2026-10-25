import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services";

export const Route = createFileRoute("/forgot-password")({
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
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
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
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <h1 className="font-display text-3xl font-semibold">Reset your password</h1>
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
        </form>
      )}
    </div>
  );
}
