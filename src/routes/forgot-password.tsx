import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — IntelliMart" },
      { name: "description", content: "Request a password reset link for your IntelliMart account." },
      { property: "og:title", content: "Reset password — IntelliMart" },
      { property: "og:description", content: "Request an IntelliMart password reset link." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <h1 className="font-display text-3xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-sm text-muted-foreground">We'll email you a reset link once an email service is connected.</p>
      {sent ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm">
          <p>If an account exists for that address, a reset link is on its way.</p>
          <Button asChild className="mt-5 w-full" variant="outline"><Link to="/login">Back to sign in</Link></Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); setSent(true); }}
          className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required />
          </div>
          <Button type="submit" variant="hero" className="w-full">Send reset link</Button>
        </form>
      )}
    </div>
  );
}
