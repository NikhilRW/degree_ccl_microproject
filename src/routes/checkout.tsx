import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { EmptyState } from "@/components/common/states";
import { AwsIntegrationPlaceholder } from "@/components/aws/AwsIntegrationPlaceholder";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { notificationService, orderService, paymentService } from "@/services";
import type { Address, DeliveryMethod, Payment } from "@/types";
import { currency } from "@/utils/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — IntelliMart" },
      { name: "description", content: "Complete your IntelliMart order: shipping, delivery, payment and review." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Checkout — IntelliMart" },
      { property: "og:description", content: "Shipping, delivery, payment and review in four steps." },
    ],
  }),
  component: CheckoutPage,
});

const steps = ["Shipping", "Delivery", "Payment", "Review"] as const;

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
  const { cart, totals, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [delivery, setDelivery] = useState<DeliveryMethod>("standard");
  const [method, setMethod] = useState<Payment["method"]>("card");
  const [card, setCard] = useState("");
  const [placing, setPlacing] = useState(false);

  const active = cart.items.filter((i) => !i.savedForLater);
  const t = totals(delivery);

  if (active.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="Nothing to check out"
          description="Add a product to your cart to continue."
          action={
            <Button asChild>
              <Link to="/shop">Browse products</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const shippingValid =
    address.fullName.trim() && address.phone.trim() && address.address.trim() && address.city.trim() && address.state.trim() && address.postalCode.trim();

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const payment = await paymentService.createPaymentIntent({
        amount: t.total,
        method,
        ...(card.length >= 4 ? { cardLast4: card.slice(-4) } : {}),
      });
      const order = await orderService.create({
        cart,
        address,
        delivery,
        payment,
        userId: user?.id ?? "u_demo_001",
      });
      if (user) void notificationService.sendOrderConfirmation(order, user);
      await clear();
      void navigate({ to: "/order-confirmation", search: { id: order.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place the order");
    } finally {
      setPlacing(false);
    }
  };

  const field = (key: keyof Address, label: string, required = true) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={address[key] ?? ""}
        required={required}
        onChange={(e) => setAddress({ ...address, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">Checkout</h1>

      <ol className="mt-8 flex flex-wrap gap-2" aria-label="Checkout steps">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-smooth",
                i < step ? "bg-success text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-surface-strong text-muted-foreground",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn("text-sm", i === step ? "font-semibold" : "text-muted-foreground")}>{s}</span>
            {i < steps.length - 1 && <span className="mx-2 hidden h-px w-8 bg-border sm:block" aria-hidden />}
          </li>
        ))}
      </ol>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-card p-6">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold">Shipping address</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("fullName", "Full name")}
                {field("phone", "Phone")}
                <div className="sm:col-span-2">{field("address", "Address")}</div>
                <div className="sm:col-span-2">{field("apartment", "Apartment, suite (optional)", false)}</div>
                {field("city", "City")}
                {field("state", "State")}
                {field("postalCode", "Postal code")}
                {field("country", "Country")}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display text-lg font-semibold">Delivery method</h2>
              <RadioGroup value={delivery} onValueChange={(v) => setDelivery(v as DeliveryMethod)} className="grid gap-3">
                {[
                  { id: "standard", title: "Standard Delivery", body: "4–6 business days", price: t.subtotal > 20000 ? "Free" : currency(199) },
                  { id: "express", title: "Express Delivery", body: "1–2 business days", price: currency(499) },
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
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as Payment["method"])} className="grid gap-3">
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

              {method === "card" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="card-number">Card number</Label>
                    <Input id="card-number" inputMode="numeric" placeholder="4242 4242 4242 4242" value={card} onChange={(e) => setCard(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="card-exp">Expiry</Label>
                    <Input id="card-exp" placeholder="MM/YY" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="card-cvc">CVC</Label>
                    <Input id="card-cvc" placeholder="123" />
                  </div>
                </div>
              )}

              <AwsIntegrationPlaceholder
                service="Payment provider + AWS Secrets Manager"
                objective="PAYMENT SERVICE — AWS / PAYMENT PROVIDER INTEGRATION ZONE. No real gateway is connected; nothing is charged."
                location="src/services/payments/index.ts"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="font-display text-lg font-semibold">Review your order</h2>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {active.map((i) => (
                  <li key={i.productId} className="flex items-center gap-3 p-3">
                    <img src={i.product.images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <span className="flex-1 text-sm">{i.product.name} × {i.quantity}</span>
                    <span className="text-sm font-semibold tabular-nums">{currency(i.product.price * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ship to</h3>
                  <p className="mt-1">{address.fullName}<br />{address.address}<br />{address.city}, {address.state} {address.postalCode}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery</h3>
                  <p className="mt-1 capitalize">{delivery}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment</h3>
                  <p className="mt-1 uppercase">{method}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between gap-3">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            {step < 3 ? (
              <Button
                variant="hero"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && !shippingValid}
              >
                Continue
              </Button>
            ) : (
              <Button variant="hero" onClick={() => void placeOrder()} disabled={placing}>
                {placing ? "Placing order…" : "Place order"}
              </Button>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-lg font-semibold">Summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{currency(t.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd className="tabular-nums">{t.shipping === 0 ? "Free" : currency(t.shipping)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tabular-nums">{currency(t.tax)}</dd></div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{currency(t.total)}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
