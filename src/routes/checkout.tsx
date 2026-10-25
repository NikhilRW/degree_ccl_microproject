import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EmptyState, LoadingState } from "@/components/common/states";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { orderService } from "@/services";
import type { Address, DeliveryMethod } from "@/types";
import { currency } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — IntelliMart" },
      { name: "description", content: "Shipping, delivery and order review." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});
const steps = ["Shipping", "Delivery", "Review"] as const;
const emptyAddress: Address = {
  fullName: "",
  phone: "",
  address: "",
  apartment: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
};

function CheckoutPage() {
  const { cart, loading: cartLoading, totals, refresh } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [delivery, setDelivery] = useState<DeliveryMethod>("standard");
  const [placing, setPlacing] = useState(false);
  const requestId = useRef<string | null>(null);
  const active = cart.items.filter((item) => !item.savedForLater);
  const t = totals(delivery);

  if (authLoading || cartLoading) return <LoadingState label="Loading checkout" />;
  if (!user)
    return (
      <div className="site-container py-20">
        <EmptyState
          title="Sign in to check out"
          description="Use your account to save your shipping details and keep track of your order."
          action={
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          }
        />
      </div>
    );
  if (!active.length)
    return (
      <div className="site-container py-20">
        <EmptyState
          title="Your bag is empty"
          description="Find something you love before checking out."
          action={
            <Button asChild>
              <Link to="/shop">Shop the collection</Link>
            </Button>
          }
        />
      </div>
    );

  const shippingValid = [
    address.fullName,
    address.phone,
    address.address,
    address.city,
    address.state,
    address.postalCode,
  ].every((value) => value.trim());
  const placeOrder = async () => {
    if (placing) return;
    setPlacing(true);
    requestId.current ??= crypto.randomUUID();
    try {
      const order = await orderService.create({
        address,
        delivery,
        method: "cod",
        idempotencyKey: requestId.current,
        expectedTotal: t.total,
      });
      void refresh();
      void navigate({ to: "/order-confirmation", search: { id: order.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not place your order.");
    } finally {
      setPlacing(false);
    }
  };
  const field = (key: keyof Address, label: string, required = true) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={address[key] ?? ""}
        required={required}
        maxLength={key === "address" ? 300 : 100}
        onChange={(event) => setAddress({ ...address, [key]: event.target.value })}
      />
    </div>
  );

  return (
    <div className="site-container pb-24 pt-10 sm:pt-16">
      <h1 className="font-display text-5xl font-medium sm:text-6xl">Checkout</h1>
      <ol className="mt-8 flex flex-wrap gap-6" aria-label="Checkout steps">
        {steps.map((label, index) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2 text-sm",
              index === step ? "font-semibold" : "text-muted-foreground",
            )}
            aria-current={index === step ? "step" : undefined}
          >
            {index < step && <Check className="h-4 w-4" aria-hidden />}
            {label}
          </li>
        ))}
      </ol>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="bg-card p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-medium">Shipping address</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {field("fullName", "Full name")}
                {field("phone", "Phone")}
                <div className="sm:col-span-2">{field("address", "Address")}</div>
                <div className="sm:col-span-2">
                  {field("apartment", "Apartment, suite (optional)", false)}
                </div>
                {field("city", "City")}
                {field("state", "State")}
                {field("postalCode", "Postal code")}
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" value="India" readOnly />
                </div>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-medium">Delivery method</h2>
              <RadioGroup
                value={delivery}
                onValueChange={(value) => setDelivery(value as DeliveryMethod)}
                className="gap-4"
              >
                {[
                  {
                    id: "standard",
                    title: "Standard delivery",
                    detail: "4–6 business days",
                    price: t.subtotal > 20000 ? "Free" : currency(199),
                  },
                  {
                    id: "express",
                    title: "Express delivery",
                    detail: "1–2 business days",
                    price: currency(499),
                  },
                ].map((option) => (
                  <Label
                    key={option.id}
                    htmlFor={option.id}
                    className="flex cursor-pointer items-center gap-4 bg-surface p-5"
                  >
                    <RadioGroupItem id={option.id} value={option.id} />
                    <span className="flex-1">
                      <span className="block text-base font-medium">{option.title}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {option.detail}
                      </span>
                    </span>
                    <span>{option.price}</span>
                  </Label>
                ))}
              </RadioGroup>
              <div className="bg-surface p-5">
                <h3 className="text-base font-medium">Cash on delivery</h3>
                <p className="mt-2 text-sm">
                  Pay the order total when your items arrive. No advance payment is required.
                </p>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-medium">Review your order</h2>
              <ul className="space-y-4">
                {active.map((item) => (
                  <li key={item.productId} className="flex items-center gap-4">
                    <img src={item.product.images[0]} alt="" className="h-16 w-16 object-cover" />
                    <span className="flex-1 text-sm">
                      {item.product.name} × {item.quantity}
                    </span>
                    <span className="text-sm tabular-nums">
                      {currency(item.product.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid gap-6 bg-surface p-5 text-sm sm:grid-cols-2">
                <div>
                  <h3 className="font-medium">Ship to</h3>
                  <p className="mt-2">
                    {address.fullName}
                    <br />
                    {address.address}
                    <br />
                    {address.city}, {address.state} {address.postalCode}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Delivery & payment</h3>
                  <p className="mt-2 capitalize">{delivery} delivery</p>
                  <p className="mt-1">Cash on delivery</p>
                </div>
              </div>
            </div>
          )}
          <div className="mt-8 flex justify-between gap-4">
            <Button
              variant="outline"
              disabled={step === 0 || placing}
              onClick={() => setStep((value) => value - 1)}
            >
              Back
            </Button>
            {step < 2 ? (
              <Button
                disabled={step === 0 && !shippingValid}
                onClick={() => setStep((value) => value + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button disabled={placing} onClick={() => void placeOrder()}>
                {placing ? "Placing order…" : "Place order"}
              </Button>
            )}
          </div>
        </div>
        <aside className="self-start bg-surface p-6 sm:p-8">
          <h2 className="text-2xl font-medium">Order summary</h2>
          <dl className="mt-6 space-y-4 text-sm">
            {[
              ["Subtotal", currency(t.subtotal)],
              ["Shipping", t.shipping ? currency(t.shipping) : "Free"],
              ["Tax (18%)", currency(t.tax)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt>{label}</dt>
                <dd className="tabular-nums">{value}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-4 text-lg font-medium">
              <dt>Due on delivery</dt>
              <dd className="tabular-nums">{currency(t.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
