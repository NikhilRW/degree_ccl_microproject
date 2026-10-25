import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
<<<<<<< HEAD
import { EmptyState, LoadingState } from "@/components/common/states";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { orderService } from "@/services";
import type { Address, DeliveryMethod } from "@/types";
=======
import { EmptyState } from "@/components/common/states";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { payForCheckout } from "@/services/payments/checkout";
import type { Address, DeliveryMethod, Payment } from "@/types";
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
import { currency } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — IntelliMart" },
<<<<<<< HEAD
      { name: "description", content: "Shipping, delivery and order review." },
      { name: "robots", content: "noindex" },
=======
      {
        name: "description",
        content: "Complete your IntelliMart order: shipping, delivery, payment and review.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Checkout — IntelliMart" },
      {
        property: "og:description",
        content: "Shipping, delivery, payment and review in four steps.",
      },
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
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
<<<<<<< HEAD
  const { cart, loading: cartLoading, totals, refresh } = useCart();
  const { user, loading: authLoading } = useAuth();
=======
  const { cart, totals, refresh } = useCart();
  const { user } = useAuth();
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [delivery, setDelivery] = useState<DeliveryMethod>("standard");
<<<<<<< HEAD
=======
  const [method, setMethod] = useState<Payment["method"]>("card");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
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
<<<<<<< HEAD
=======
  }

  const shippingValid =
    address.fullName.trim() &&
    address.phone.trim() &&
    address.address.trim() &&
    address.city.trim() &&
    address.state.trim() &&
    address.postalCode.trim();
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094

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
<<<<<<< HEAD
      const order = await orderService.create({
        address,
        delivery,
        method: "cod",
        idempotencyKey: requestId.current,
        expectedTotal: t.total,
      });
      void refresh();
=======
      if (!user)
        throw new Error(
          "Sign in before placing your order. Your guest cart will be merged automatically.",
        );
      const order = await payForCheckout({ address, delivery, method, idempotencyKey });
      // The server removes purchased quantities atomically; do not clear items
      // added while payment was open.
      await refresh().catch(() =>
        toast.error("Order placed; reload the page to refresh your cart."),
      );
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
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
<<<<<<< HEAD
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
=======
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">Checkout</h1>

      <ol className="mt-8 flex flex-wrap gap-2" aria-label="Checkout steps">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-smooth",
                i < step
                  ? "bg-success text-primary-foreground"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-strong text-muted-foreground",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn("text-sm", i === step ? "font-semibold" : "text-muted-foreground")}>
              {s}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-2 hidden h-px w-8 bg-border sm:block" aria-hidden />
            )}
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
          </li>
        ))}
      </ol>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="bg-card p-6 sm:p-8">
          {step === 0 && (
<<<<<<< HEAD
            <div className="space-y-6">
              <h2 className="text-2xl font-medium">Shipping address</h2>
              <div className="grid gap-5 sm:grid-cols-2">
=======
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold">Shipping address</h2>
              {!!user?.addresses.length && (
                <Label>
                  Use a saved address
                  <select
                    className="mt-2 block h-10 w-full rounded border border-input bg-background px-3"
                    defaultValue=""
                    onChange={(event) => {
                      const saved = user.addresses[Number(event.target.value)];
                      if (saved) setAddress(saved);
                    }}
                  >
                    <option value="" disabled>
                      Choose an address
                    </option>
                    {user.addresses.map((saved, index) => (
                      <option key={index} value={index}>
                        {saved.fullName} — {saved.address}, {saved.city}
                      </option>
                    ))}
                  </select>
                </Label>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
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
<<<<<<< HEAD
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
=======
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold">Delivery method</h2>
              <RadioGroup
                value={delivery}
                onValueChange={(v) => setDelivery(v as DeliveryMethod)}
                className="grid gap-3"
              >
                {[
                  {
                    id: "standard",
                    title: "Standard Delivery",
                    body: "4–6 business days",
                    price: t.subtotal > 20000 ? "Free" : currency(199),
                  },
                  {
                    id: "express",
                    title: "Express Delivery",
                    body: "1–2 business days",
                    price: currency(499),
                  },
                ].map((o) => (
                  <Label
                    key={o.id}
                    htmlFor={o.id}
                    className="flex cursor-pointer items-center gap-4 rounded-xl border border-border p-4 transition-smooth has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <RadioGroupItem id={o.id} value={o.id} />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{o.title}</span>
                      <span className="block text-xs text-muted-foreground">{o.body}</span>
                    </span>
                    <span className="text-sm font-semibold">{o.price}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold">Payment</h2>
              <RadioGroup
                value={method}
                onValueChange={(v) => setMethod(v as Payment["method"])}
                className="grid gap-3"
              >
                {[
                  { id: "card", label: "Credit / debit card" },
                  { id: "upi", label: "UPI" },
                  { id: "cod", label: "Cash on delivery" },
                ].map((o) => (
                  <Label
                    key={o.id}
                    htmlFor={`pay-${o.id}`}
                    className="flex cursor-pointer items-center gap-4 rounded-xl border border-border p-4 transition-smooth has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <RadioGroupItem id={`pay-${o.id}`} value={o.id} />
                    <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="text-sm font-medium">{o.label}</span>
                  </Label>
                ))}
              </RadioGroup>

              <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                Card and UPI use provider-hosted Razorpay test checkout in cloud mode, or a labelled
                simulation in demo mode. IntelliMart does not collect card numbers or CVC. Server
                pricing and availability are rechecked before payment.
              </p>
              {!user && (
                <Button asChild>
                  <Link to="/login">Sign in to check out</Link>
                </Button>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="font-display text-lg font-semibold">Review your order</h2>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {active.map((i) => (
                  <li key={i.productId} className="flex items-center gap-3 p-3">
                    <img
                      src={i.product.images[0]}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                    <span className="flex-1 text-sm">
                      {i.product.name} × {i.quantity}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {currency(i.product.price * i.quantity)}
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid gap-6 bg-surface p-5 text-sm sm:grid-cols-2">
                <div>
<<<<<<< HEAD
                  <h3 className="font-medium">Ship to</h3>
                  <p className="mt-2">
=======
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ship to
                  </h3>
                  <p className="mt-1">
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
                    {address.fullName}
                    <br />
                    {address.address}
                    <br />
                    {address.city}, {address.state} {address.postalCode}
                  </p>
                </div>
                <div>
<<<<<<< HEAD
                  <h3 className="font-medium">Delivery & payment</h3>
                  <p className="mt-2 capitalize">{delivery} delivery</p>
                  <p className="mt-1">Cash on delivery</p>
=======
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Delivery
                  </h3>
                  <p className="mt-1 capitalize">{delivery}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Payment
                  </h3>
                  <p className="mt-1 uppercase">{method}</p>
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
                </div>
              </div>
            </div>
          )}
<<<<<<< HEAD
          <div className="mt-8 flex justify-between gap-4">
            <Button
              variant="outline"
              disabled={step === 0 || placing}
              onClick={() => setStep((value) => value - 1)}
=======

          <div className="mt-8 flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
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
<<<<<<< HEAD
              <Button disabled={placing} onClick={() => void placeOrder()}>
=======
              <Button variant="hero" onClick={() => void placeOrder()} disabled={placing || !user}>
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
                {placing ? "Placing order…" : "Place order"}
              </Button>
            )}
          </div>
        </div>
<<<<<<< HEAD
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
=======

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">{currency(t.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="tabular-nums">{t.shipping === 0 ? "Free" : currency(t.shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="tabular-nums">{currency(t.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{currency(t.total)}</dd>
              </div>
            </dl>
          </div>
>>>>>>> 9b6cd397646ca9c6897976644249620454a40094
        </aside>
      </div>
    </div>
  );
}
