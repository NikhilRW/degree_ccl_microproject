import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { saveProfile } from "@/server/auth.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Address } from "@/types";

const emptyAddress = (): Address => ({
  fullName: "",
  phone: "",
  address: "",
  apartment: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
});
export function ProfileEditor() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [addresses, setAddresses] = useState<Address[]>(user?.addresses ?? []);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await saveProfile({ data: { name, addresses } });
      await refresh();
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile update failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border p-6">
      <Label htmlFor="profile-name">Full name</Label>
      <Input
        id="profile-name"
        value={name}
        required
        onChange={(event) => setName(event.target.value)}
      />
      <p className="text-sm text-muted-foreground">
        {user?.email} — email changes are managed through your identity provider.
      </p>
      {addresses.map((address, index) => (
        <fieldset
          key={index}
          className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"
        >
          <legend>Address {index + 1}</legend>
          {(
            ["fullName", "phone", "address", "apartment", "city", "state", "postalCode"] as const
          ).map((field) => (
            <div key={field}>
              <Label htmlFor={`address-${index}-${field}`}>{field}</Label>
              <Input
                id={`address-${index}-${field}`}
                value={address[field] ?? ""}
                required={field !== "apartment"}
                onChange={(event) =>
                  setAddresses((values) =>
                    values.map((item, position) =>
                      position === index ? { ...item, [field]: event.target.value } : item,
                    ),
                  )
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setAddresses((values) => values.filter((_, position) => position !== index))
            }
          >
            Remove address
          </Button>
        </fieldset>
      ))}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={addresses.length >= 5 || busy}
          onClick={() => setAddresses((values) => [...values, emptyAddress()])}
        >
          Add address
        </Button>
        <Button type="submit" disabled={busy}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
