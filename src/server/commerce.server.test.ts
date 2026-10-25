import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHmac, randomUUID } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Product, User, Order } from "@/types";
import type { Records, Row } from "./records.server";

const state = vi.hoisted(() => ({
  records: null as Records | null,
  cookies: new Map<string, string>(),
  ses: vi.fn(async () => ({})),
}));
vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (name: string) => state.cookies.get(name),
  setCookie: (name: string, value: string) => state.cookies.set(name, value),
  deleteCookie: (name: string) => state.cookies.delete(name),
}));
vi.mock("./records.server", async (original) => ({
  ...(await original<typeof import("./records.server")>()),
  getRecords: () => {
    if (!state.records) throw new Error("Test store not initialized");
    return state.records;
  },
}));
vi.mock("./clients.server", () => ({ getAwsClients: () => ({ ses: { send: state.ses } }) }));

import { createFileRecords, change } from "./records.server";
import { signIn, requireUser, requireAdmin, getCurrentSession } from "./auth.server";
import { mutateCart, mergeShopping, shoppingState } from "./shopping.server";
import {
  beginCheckout,
  finalizePayment,
  cancelOrder,
  reconcileOrder,
  ownedOrder,
  updateOrderStatus,
  verifyCheckout,
  resumeCheckout,
} from "./orders.server";
import { submitReview, moderateReview, saveCategory } from "./admin.server";
import { getCatalogueStore } from "./catalogue.server";
import { handleRazorpayWebhook } from "./webhook.server";
import { checkoutSchema } from "./validation";

const product: Product = {
  id: "p1",
  slug: "lab-product",
  name: "Lab product",
  category: "Lab",
  categoryId: "lab",
  description: "Synthetic test product",
  highlights: [],
  specifications: {},
  images: ["https://example.com/image.png"],
  price: 100,
  originalPrice: 150,
  stock: 5,
  featured: true,
  rating: 0,
  reviewCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  tags: [],
  version: 0,
};
const address = {
  fullName: "Test Customer",
  phone: "9999999999",
  address: "Synthetic test street",
  city: "Mumbai",
  state: "Maharashtra",
  postalCode: "400001",
  country: "India" as const,
};
const input = (method: "card" | "cod" = "card") => ({
  address,
  delivery: "standard" as const,
  method,
  idempotencyKey: randomUUID(),
});
let directory: string;
let user: User;
beforeEach(async () => {
  const parent = join(tmpdir(), "opencode");
  await mkdir(parent, { recursive: true });
  directory = await mkdtemp(join(parent, "intellimart-commerce-"));
  state.cookies.clear();
  state.ses.mockReset();
  state.ses.mockResolvedValue({});
  vi.stubEnv("INTELLIMART_MODE", "demo");
  vi.stubEnv("INTELLIMART_DEMO_ADMIN", "false");
  vi.stubEnv("SESSION_SECRET", "");
  const seed: Row[] = [
    { kind: "PRODUCT", id: product.id, rev: 1, value: structuredClone(product) },
    {
      kind: "CATEGORY",
      id: "lab",
      rev: 1,
      value: {
        id: "lab",
        slug: "lab",
        name: "Lab",
        description: "Lab catalogue",
        image: "https://example.com/category.png",
        productCount: 1,
      },
    },
  ];
  state.records = createFileRecords(join(directory, "application.json"), async () =>
    structuredClone(seed),
  );
  user = (await signIn(`${randomUUID()}@example.com`, "demo-password")).user;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

describe("authenticated shopping and transactional orders", () => {
  it("uses an opaque cookie, hides tokens, and isolates shopping accounts", async () => {
    expect((await getCurrentSession())?.accessToken).toBeUndefined();
    expect(() => JSON.stringify([...state.cookies.values()])).not.toThrow();
    await mutateCart({ action: "add", productId: "p1", quantity: 2 });
    state.cookies.clear();
    expect(await shoppingState()).toBeNull();
    await expect(requireUser()).rejects.toThrow("Sign in");
    await signIn("bob@example.com", "demo-password");
    expect((await shoppingState())!.cart.items).toHaveLength(0);
    await expect(requireAdmin()).rejects.toThrow("disabled");
  });
  it("merges a batch once while allowing identical future batches", async () => {
    const guest = { mergeId: randomUUID(), cart: [{ productId: "p1", quantity: 2 }], wishlist: [] };
    await mergeShopping(guest);
    await mergeShopping(guest);
    expect((await shoppingState())!.cart.items[0]?.quantity).toBe(2);
    await mergeShopping({ ...guest, mergeId: randomUUID() });
    expect((await shoppingState())!.cart.items[0]?.quantity).toBe(4);
  });
  it("prices from persisted products and creates COD orders only once", async () => {
    await mutateCart({ action: "add", productId: "p1", quantity: 2 });
    const request = input("cod");
    const first = await beginCheckout(request, user);
    const second = await beginCheckout(request, user);
    expect(first.order.id).toBe(second.order.id);
    expect(first.order.totals.total).toBe(435);
    expect(first.amount).toBe(43500);
    expect(first.order.payment.status).toBe("pending");
    expect((await state.records!.get<Product>("PRODUCT", "p1"))!.value.stock).toBe(3);
    expect((await shoppingState())!.cart.items).toHaveLength(0);
    expect(checkoutSchema.safeParse({ ...request, userId: "someone-else", total: 1 }).success).toBe(
      false,
    );
    await expect(beginCheckout({ ...request, method: "card" }, user)).rejects.toThrow(
      "different shipping/payment details",
    );
  });
  it("reserves stock once, finalizes once, and refunds/restocks cancellation once", async () => {
    await mutateCart({ action: "add", productId: "p1", quantity: 1 });
    const prepared = await beginCheckout(input(), user);
    expect((await resumeCheckout(prepared.order.id, user)).order.id).toBe(prepared.order.id);
    await expect(
      resumeCheckout(prepared.order.id, { ...user, id: "another-admin", isAdmin: true }),
    ).rejects.toThrow("Only the customer");
    await finalizePayment(prepared.order.id, "demo-payment", true);
    await finalizePayment(prepared.order.id, "demo-payment", true);
    expect((await state.records!.get<Product>("PRODUCT", "p1"))!.value.stock).toBe(4);
    const cancelled = await cancelOrder(prepared.order.id, user);
    expect(cancelled.payment.status).toBe("refunded");
    await cancelOrder(prepared.order.id, user);
    expect((await state.records!.get<Product>("PRODUCT", "p1"))!.value.stock).toBe(5);
    await expect(
      ownedOrder(prepared.order.id, { ...user, id: "another-user", isAdmin: false }),
    ).rejects.toThrow("not found");
  });
  it("releases an expired reservation and compensates a late captured payment", async () => {
    await mutateCart({ action: "add", productId: "p1", quantity: 1 });
    const prepared = await beginCheckout(input(), user);
    const row = await state.records!.get<Order>("ORDER", prepared.order.id);
    await state.records!.transaction([
      change("ORDER", row!.id, row, { ...row!.value, reservationExpiresAt: Date.now() - 1 }),
    ]);
    await reconcileOrder(row!.id);
    expect((await state.records!.get<Product>("PRODUCT", "p1"))!.value.stock).toBe(5);
    const late = await finalizePayment(row!.id, "demo-late-payment", true);
    expect(late.status).toBe("cancelled");
    expect(late.payment.status).toBe("refunded");
  });
  it("enforces stock limits, stale admin edits and category integrity", async () => {
    await expect(mutateCart({ action: "add", productId: "p1", quantity: 6 })).rejects.toThrow(
      "stock",
    );
    await mutateCart({ action: "add", productId: "p1", quantity: 1 });
    await beginCheckout(input(), user);
    await expect(
      getCatalogueStore().upsert({
        id: "p1",
        expectedVersion: 0,
        name: "Lab product",
        slug: "lab-product",
        categoryId: "lab",
        description: "Updated synthetic description",
        imageUrl: "https://example.com/image.png",
        price: 100,
        originalPrice: 150,
        stock: 5,
        featured: true,
      }),
    ).rejects.toThrow("changed");
    await expect(
      saveCategory(
        {
          id: "lab",
          name: "Lab",
          description: "Lab catalogue",
          image: "https://example.com/category.png",
          archived: true,
          expectedVersion: 0,
        },
        { ...user, isAdmin: true },
      ),
    ).rejects.toThrow("active products");
  });
  it("requires delivered purchases, moderates reviews, and restricts order transitions", async () => {
    const review = {
      productId: "p1",
      title: "Great lab product",
      body: "This is a synthetic customer review.",
      rating: 5,
    };
    await expect(submitReview(review, user)).rejects.toThrow("delivered purchase");
    await mutateCart({ action: "add", productId: "p1", quantity: 1 });
    const prepared = await beginCheckout(input("cod"), user);
    const admin = { ...user, isAdmin: true };
    await expect(
      updateOrderStatus(prepared.order.id, "delivered", prepared.order.version!, admin),
    ).rejects.toThrow("transition");
    const shipped = await updateOrderStatus(
      prepared.order.id,
      "shipped",
      prepared.order.version!,
      admin,
    );
    await expect(cancelOrder(shipped.id, user)).rejects.toThrow("shipped");
    await updateOrderStatus(shipped.id, "delivered", shipped.version!, admin);
    const submitted = await submitReview(review, user);
    expect(submitted.status).toBe("pending");
    await expect(submitReview(review, user)).rejects.toThrow("already submitted");
    await moderateReview(submitted.id, "approved", admin);
    expect((await getCatalogueStore().snapshot(false)).products[0]?.rating).toBe(5);
  });
});

function cloudConfiguration() {
  const values: Record<string, string> = {
    INTELLIMART_MODE: "cloud",
    APP_URL: "https://lab.example.com",
    AWS_REGION: "ap-south-1",
    DYNAMODB_TABLE: "lab-test",
    COGNITO_USER_POOL_ID: "ap-south-1_testpool",
    COGNITO_CLIENT_ID: "testclient",
    SESSION_SECRET: Buffer.alloc(32, 7).toString("base64"),
    S3_MEDIA_BUCKET: "lab-media",
    MEDIA_BASE_URL: "https://media.example.com",
    SES_FROM_EMAIL: "sender@example.com",
    RAZORPAY_SECRET_ID: "",
    RAZORPAY_KEY_ID: "rzp_test_dummy",
    RAZORPAY_KEY_SECRET: "test-provider-secret",
    RAZORPAY_WEBHOOK_SECRET: "test-webhook-secret",
  };
  Object.entries(values).forEach(([key, value]) => vi.stubEnv(key, value));
}
async function prepareCloudPayment() {
  await mutateCart({ action: "add", productId: "p1", quantity: 1 });
  cloudConfiguration();
  const fetchMock = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).endsWith("/orders") && options?.method === "POST") {
      const body = JSON.parse(String(options.body));
      return Response.json({
        id: "order_testABC",
        amount: body.amount,
        currency: "INR",
        receipt: body.receipt,
      });
    }
    return Response.json({
      id: "pay_testABC",
      order_id: "order_testABC",
      amount: 31700,
      currency: "INR",
      status: "captured",
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  const prepared = await beginCheckout(input(), user);
  return { prepared, fetchMock };
}
describe("cloud payment protocol with mocked external services", () => {
  it("rejects forged signatures and cloud simulation, then verifies captured provider details", async () => {
    const { prepared } = await prepareCloudPayment();
    await expect(
      verifyCheckout(prepared.order.id, "pay_testABC", "0".repeat(64), user),
    ).rejects.toThrow("signature");
    await expect(finalizePayment(prepared.order.id, "demo", true)).rejects.toThrow("forbidden");
    const signature = createHmac("sha256", "test-provider-secret")
      .update("order_testABC|pay_testABC")
      .digest("hex");
    const confirmed = await verifyCheckout(prepared.order.id, "pay_testABC", signature, user);
    expect(confirmed.payment.status).toBe("captured");
    expect(confirmed.providerPaymentId).toBe("pay_testABC");
  });
  it.each([
    { id: "pay_wrong" },
    { amount: 1 },
    { currency: "USD" },
    { order_id: "order_wrong" },
    { status: "authorized" },
  ])("rejects mismatched provider details %j", async (incorrect) => {
    const { prepared, fetchMock } = await prepareCloudPayment();
    fetchMock.mockResolvedValue(
      Response.json({
        id: "pay_testABC",
        order_id: "order_testABC",
        amount: 31700,
        currency: "INR",
        status: "captured",
        ...incorrect,
      }),
    );
    await expect(finalizePayment(prepared.order.id, "pay_testABC")).rejects.toThrow(
      "correct order",
    );
    expect(
      (await state.records!.get<Order>("ORDER", prepared.order.id))!.value.payment.status,
    ).toBe("pending");
  });
  it("verifies raw-body webhooks and deduplicates delivery", async () => {
    const { prepared } = await prepareCloudPayment();
    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_testABC", order_id: "order_testABC" } } },
    });
    const signature = createHmac("sha256", "test-webhook-secret").update(body).digest("hex");
    const request = (sig: string) =>
      new Request("https://lab.example.com/webhooks/razorpay", {
        method: "POST",
        headers: { "x-razorpay-signature": sig },
        body,
      });
    expect((await handleRazorpayWebhook(request("0".repeat(64)))).status).toBe(401);
    expect((await handleRazorpayWebhook(request(signature))).status).toBe(200);
    expect(await (await handleRazorpayWebhook(request(signature))).json()).toMatchObject({
      duplicate: true,
    });
    expect((await state.records!.get<Product>("PRODUCT", "p1"))!.value.stock).toBe(4);
    expect(
      (await state.records!.get<Order>("ORDER", prepared.order.id))!.value.payment.status,
    ).toBe("captured");
  });
  it("keeps a paid order valid when SES fails", async () => {
    const { prepared } = await prepareCloudPayment();
    state.ses.mockRejectedValueOnce(new Error("Synthetic SES failure"));
    const confirmed = await finalizePayment(prepared.order.id, "pay_testABC");
    expect(confirmed.payment.status).toBe("captured");
    expect((await state.records!.list<{ status: string }>("NOTICE"))[0]?.value.status).toBe(
      "failed",
    );
  });
});
