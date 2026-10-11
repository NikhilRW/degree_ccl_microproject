import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { confirmUser, resendUserCode } from "@/server/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (raw: Record<string, unknown>) => ({
    email: typeof raw["email"] === "string" ? raw["email"] : "",
  }),
  head: () => ({ meta: [{ title: "Verify email — IntelliMart" }] }),
  component: VerifyEmail,
});
function VerifyEmail() {
  const initial = Route.useSearch();
  const [email, setEmail] = useState(initial.email);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await confirmUser({ data: { email, code } });
      toast.success("Email verified. You can sign in.");
      void navigate({ to: "/login" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">Verify your email</h1>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-border p-6">
        <Label htmlFor="verification-email">Email</Label>
        <Input
          id="verification-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Label htmlFor="verification-code">Six-digit code</Label>
        <Input
          id="verification-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <Button type="submit" disabled={busy}>
          Verify
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void resendUserCode({ data: { email } })
              .then(
                () => toast.success("Verification code requested"),
                (error: Error) => toast.error(error.message),
              )
              .finally(() => setBusy(false));
          }}
        >
          Resend code
        </Button>
        <Link to="/login" className="block text-sm text-primary">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
