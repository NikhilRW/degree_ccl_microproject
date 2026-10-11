import { z } from "zod";
import {
  ListUsersCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
  AdminUserGlobalSignOutCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { Category, Order, Product, Review, User } from "@/types";
import { change, getRecords, auditChange, retryConflict } from "./records.server";
import { getRuntimeConfig } from "./runtime.server";
import { getAwsClients } from "./clients.server";
import { isCognitoAdmin } from "./auth.server";

export const categorySchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().min(3).max(500),
    image: z
      .string()
      .url()
      .refine((url) => url.startsWith("https://"), "Use an HTTPS image URL"),
    archived: z.boolean(),
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .strict();
export async function saveCategory(input: z.infer<typeof categorySchema>, actor: User) {
  const row = await getRecords().get<Category>("CATEGORY", input.id);
  if (row && input.expectedVersion !== (row.value.version ?? 0))
    throw new Error("Category changed. Refresh before saving.");
  if (
    input.archived &&
    (await getRecords().list<Product>("PRODUCT")).some(
      (product) => !product.value.archived && product.value.categoryId === input.id,
    )
  )
    throw new Error("Archive or reassign the category's active products first.");
  const value: Category = {
    id: input.id,
    slug: input.id,
    name: input.name,
    description: input.description,
    image: input.image,
    archived: input.archived,
    productCount: 0,
    version: (row?.value.version ?? 0) + 1,
  };
  await getRecords().transaction([
    change("CATEGORY", input.id, row, value),
    auditChange(
      actor.id,
      input.archived ? "category.archived" : row ? "category.updated" : "category.created",
      input.id,
    ),
  ]);
  return value;
}
export async function listCustomers(token?: string) {
  const config = getRuntimeConfig();
  if (config.mode === "demo")
    return {
      customers: (await getRecords().list<User>("PROFILE")).map((row) => ({
        ...row.value,
        username: row.value.id,
      })),
      nextToken: "",
    };
  const result = await getAwsClients().cognito.send(
    new ListUsersCommand({
      UserPoolId: config.userPoolId,
      Limit: 50,
      ...(token ? { PaginationToken: token } : {}),
    }),
  );
  return {
    customers: (result.Users ?? []).map((remote) => {
      const attrs = Object.fromEntries(
        (remote.Attributes ?? []).map((attribute) => [attribute.Name!, attribute.Value ?? ""]),
      );
      return {
        id: attrs["sub"] ?? "",
        username: remote.Username ?? "",
        email: attrs["email"] ?? "",
        name: attrs["name"] ?? "",
        disabled: !remote.Enabled,
        createdAt: remote.UserCreateDate?.toISOString() ?? "",
        addresses: [],
      } satisfies User & { username: string };
    }),
    nextToken: result.PaginationToken ?? "",
  };
}
export async function setCustomerEnabled(username: string, enabled: boolean, actor: User) {
  const config = getRuntimeConfig();
  if (config.mode === "cloud") {
    if (await isCognitoAdmin(username))
      throw new Error(
        "Administrators cannot be disabled through this customer screen. Manage administrator access in Cognito.",
      );
    const params = { UserPoolId: config.userPoolId, Username: username };
    await getAwsClients().cognito.send(
      enabled ? new AdminEnableUserCommand(params) : new AdminDisableUserCommand(params),
    );
    if (!enabled) await getAwsClients().cognito.send(new AdminUserGlobalSignOutCommand(params));
  } else {
    const row = await getRecords().get<User>("PROFILE", username);
    if (!row || row.id === actor.id || row.value.isAdmin)
      throw new Error("Cannot change this customer.");
    await getRecords().transaction([
      change("PROFILE", username, row, { ...row.value, disabled: !enabled }),
    ]);
  }
  await getRecords().transaction([
    auditChange(actor.id, enabled ? "customer.enabled" : "customer.disabled", username),
  ]);
}
export async function submitReview(
  input: { productId: string; title: string; body: string; rating: number },
  user: User,
) {
  const eligible = (await getRecords().list<Order>("ORDER")).some(
    (row) =>
      row.value.userId === user.id &&
      row.value.status === "delivered" &&
      row.value.items.some((item) => item.productId === input.productId),
  );
  if (!eligible) throw new Error("Reviews require a delivered purchase of this product.");
  const product = await getRecords().get<Product>("PRODUCT", input.productId);
  if (!product || product.value.archived) throw new Error("Product not available for review.");
  const id = `${input.productId}#${user.id}`;
  if (await getRecords().get("REVIEW", id))
    throw new Error("You have already submitted a review for this product.");
  const value: Review = {
    ...input,
    id,
    author: user.name,
    userId: user.id,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await getRecords().transaction([change("REVIEW", id, null, value)]);
  return value;
}
export async function moderateReview(id: string, status: "approved" | "rejected", actor: User) {
  await retryConflict(async () => {
    const row = await getRecords().get<Review>("REVIEW", id);
    if (!row) throw new Error("Review not found.");
    await getRecords().transaction([
      change("REVIEW", id, row, { ...row.value, status }),
      auditChange(actor.id, `review.${status}`, id),
    ]);
  });
}
