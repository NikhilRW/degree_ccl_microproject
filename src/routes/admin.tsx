import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { getRuntimeInfo } from "@/server/runtime.functions";
import {
  archiveAdminProduct,
  getAdminCatalogue,
  saveAdminProduct,
} from "@/server/catalogue.functions";
import { productEditSchema, type ProductEdit } from "@/services/admin/schema";
import type { Product } from "@/types";
import { currency, formatDate } from "@/utils/format";
import { useAuth } from "@/hooks/useAuth";
import { AdminOperations } from "@/components/admin/AdminOperations";
import { getAdminOrders } from "@/server/admin.functions";
import { storageService } from "@/services/storage";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administration — IntelliMart" }, { name: "robots", content: "noindex" }],
  }),
  loader: () => getRuntimeInfo(),
  component: AdminPage,
});

const emptyProduct = (): ProductEdit => ({
  name: "",
  slug: "",
  categoryId: "electronics",
  description: "",
  imageUrl: "",
  price: 0,
  originalPrice: 0,
  stock: 0,
  featured: false,
});

function editProduct(product: Product): ProductEdit {
  return {
    id: product.id,
    expectedVersion: product.version ?? 0,
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId,
    description: product.description,
    imageUrl: product.images[0] ?? "",
    price: product.price,
    originalPrice: product.originalPrice,
    stock: product.stock,
    featured: product.featured,
    highlights: product.highlights,
    additionalImages: product.images.slice(1),
    tags: product.tags,
  };
}

function AdminPage() {
  const runtime = Route.useLoaderData();
  const { user, loading: authLoading } = useAuth();
  const allowed = runtime.mode === "demo" ? runtime.demoAdmin : !!user?.isAdmin;
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<ProductEdit | null>(null);
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [specsText, setSpecsText] = useState("{}");
  const catalogue = useQuery({
    queryKey: ["admin-catalogue", user?.id],
    queryFn: () => getAdminCatalogue(),
    enabled: allowed,
  });
  const orderSummary = useQuery({
    queryKey: ["admin-orders", user?.id],
    queryFn: () => getAdminOrders(),
    enabled: allowed,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-catalogue"] });
  const save = useMutation({
    mutationFn: (input: ProductEdit) => saveAdminProduct({ data: input }),
    onSuccess: async () => {
      setEditor(null);
      setFormError("");
      await refresh();
      toast.success("Product saved");
    },
    onError: (error) => setFormError(error.message),
  });
  const archive = useMutation({
    mutationFn: (product: Product) =>
      archiveAdminProduct({
        data: {
          id: product.id,
          expectedVersion: product.version ?? 0,
          archived: !product.archived,
        },
      }),
    onSuccess: async () => {
      await refresh();
      toast.success("Product visibility updated");
    },
    onError: (error) => toast.error(error.message),
  });

  if (runtime.mode === "cloud" && authLoading)
    return <LoadingState label="Checking admin session" />;
  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title={
            runtime.mode === "demo"
              ? "Demo administration is disabled"
              : "Administrator sign-in required"
          }
          description={
            runtime.mode === "demo"
              ? "Set INTELLIMART_DEMO_ADMIN=true for a local synthetic-data demonstration only."
              : "Sign in with a Cognito account in the configured admin group. Public registration never grants admin access."
          }
          action={
            <Button asChild>
              <Link to="/">Back to storefront</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (catalogue.isPending)
    return (
      <div className="p-12">
        <LoadingState label="Loading demo catalogue" />
      </div>
    );
  if (catalogue.isError)
    return (
      <div className="p-12">
        <ErrorState message={catalogue.error.message} onRetry={() => void catalogue.refetch()} />
      </div>
    );

  const { products, categories, audit } = catalogue.data;
  const active = products.filter((product) => !product.archived);
  const visible = products.filter((product) =>
    `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    let specifications: unknown;
    try {
      specifications = JSON.parse(specsText);
    } catch {
      setFormError("Specifications must be a JSON object of text values.");
      return;
    }
    const parsed = productEditSchema.safeParse({
      ...editor,
      specifications,
      highlights: editor?.highlights?.map((value) => value.trim()).filter(Boolean),
      additionalImages: editor?.additionalImages?.map((value) => value.trim()).filter(Boolean),
      tags: editor?.tags?.map((value) => value.trim()).filter(Boolean),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues.map((issue) => issue.message).join(". "));
      return;
    }
    setFormError("");
    save.mutate(parsed.data);
  };
  const startEdit = (product?: Product) => {
    setFormError("");
    setSpecsText(JSON.stringify(product?.specifications ?? {}, null, 2));
    setEditor(product ? editProduct(product) : emptyProduct());
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Implementation lab
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            {runtime.mode === "demo" ? "Demo administration" : "Administration"}
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/shop">View storefront</Link>
        </Button>
      </div>
      {runtime.mode === "demo" && (
        <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Local demo only. Anyone who can reach this server can use enabled demo administration;
          mock login is not an admin permission check. Do not deploy with real data. Changes persist
          in the local application file, not AWS. Cloud administration uses verified Cognito
          sessions and live group checks.
        </p>
      )}
      <Tabs defaultValue="dashboard" className="mt-8">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="products">Products & deals</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="operations">Orders, categories & customers</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Active products", value: active.length },
              {
                label: "Low stock (≤10)",
                value: active.filter((product) => product.stock <= 10).length,
              },
              {
                label: "Featured products",
                value: active.filter((product) => product.featured).length,
              },
              { label: "Archived products", value: products.length - active.length },
              { label: "Orders", value: orderSummary.data?.length ?? 0 },
              {
                label: "Processing orders",
                value:
                  orderSummary.data?.filter((order) => order.status === "processing").length ?? 0,
              },
              {
                label: "Paid sales (INR)",
                value: currency(
                  (orderSummary.data ?? [])
                    .filter(
                      (order) =>
                        order.payment.status === "captured" && order.status !== "cancelled",
                    )
                    .reduce((sum, order) => sum + order.totals.total, 0),
                ),
              },
            ].map((item) => (
              <section key={item.label} className="rounded-2xl border border-border bg-card p-6">
                <h2 className="text-sm text-muted-foreground">{item.label}</h2>
                <p className="mt-3 font-display text-3xl font-semibold">{item.value}</p>
              </section>
            ))}
          </div>
          <h2 className="mt-8 font-display text-xl font-semibold">Catalogue categories</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <li key={category.id} className="rounded-xl border border-border p-4">
                <span className="font-medium">{category.name}</span>
                <p className="text-sm text-muted-foreground">
                  {category.productCount} active products
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            Summaries use stored records. Demo mode includes synthetic sample orders; cloud mode
            uses your DynamoDB data. Razorpay payments are test-only.
          </p>
        </TabsContent>
        <TabsContent value="products" className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              aria-label="Search admin products"
              placeholder="Search products or categories"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-sm"
            />
            <Button onClick={() => startEdit()} disabled={save.isPending}>
              Add product
            </Button>
            <Button variant="outline" onClick={() => void catalogue.refetch()}>
              Refresh
            </Button>
          </div>
          {editor && (
            <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-xl font-semibold">
                {editor.id ? "Edit product" : "New product"}
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Name</Label>
                  <Input
                    id="product-name"
                    required
                    value={editor.name}
                    onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-slug">Unique slug</Label>
                  <Input
                    id="product-slug"
                    required
                    placeholder="wireless-headphones"
                    value={editor.slug}
                    onChange={(event) => setEditor({ ...editor, slug: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-category">Category</Label>
                  <select
                    id="product-category"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={editor.categoryId}
                    onChange={(event) => setEditor({ ...editor, categoryId: event.target.value })}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id} disabled={category.archived}>
                        {category.name}
                        {category.archived ? " (archived)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-stock">Stock</Label>
                  <Input
                    id="product-stock"
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editor.stock}
                    onChange={(event) =>
                      setEditor({ ...editor, stock: event.target.valueAsNumber })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-price">Sale price (INR)</Label>
                  <Input
                    id="product-price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editor.price}
                    onChange={(event) =>
                      setEditor({ ...editor, price: event.target.valueAsNumber })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-original-price">Original price (INR)</Label>
                  <Input
                    id="product-original-price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editor.originalPrice}
                    onChange={(event) =>
                      setEditor({ ...editor, originalPrice: event.target.valueAsNumber })
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-image">Image URL (HTTPS)</Label>
                  <Input
                    id="product-image"
                    type="url"
                    required
                    value={editor.imageUrl}
                    onChange={(event) => setEditor({ ...editor, imageUrl: event.target.value })}
                  />
                  {runtime.mode === "cloud" && (
                    <div className="mt-3">
                      <Label htmlFor="product-upload">
                        Or upload to private S3 (JPEG/PNG/WebP, ≤5 MB)
                      </Label>
                      <Input
                        id="product-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          void storageService
                            .uploadFile(file)
                            .then(
                              (media) =>
                                setEditor((current) =>
                                  current ? { ...current, imageUrl: media.url } : current,
                                ),
                              (error: Error) => toast.error(error.message),
                            )
                            .finally(() => setUploading(false));
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-description">Description</Label>
                  <Textarea
                    id="product-description"
                    required
                    minLength={10}
                    value={editor.description}
                    onChange={(event) => setEditor({ ...editor, description: event.target.value })}
                  />
                </div>
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editor.featured}
                    onChange={(event) => setEditor({ ...editor, featured: event.target.checked })}
                  />
                  Featured product
                </Label>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-gallery">
                    Additional gallery image URLs (one per line)
                  </Label>
                  <Textarea
                    id="product-gallery"
                    value={(editor.additionalImages ?? []).join("\n")}
                    onChange={(event) =>
                      setEditor({ ...editor, additionalImages: event.target.value.split("\n") })
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-highlights">Highlights (one per line)</Label>
                  <Textarea
                    id="product-highlights"
                    value={(editor.highlights ?? []).join("\n")}
                    onChange={(event) =>
                      setEditor({ ...editor, highlights: event.target.value.split("\n") })
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-specifications">
                    Specifications (JSON object, text values)
                  </Label>
                  <Textarea
                    id="product-specifications"
                    value={specsText}
                    onChange={(event) => setSpecsText(event.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product-tags">Search tags (comma-separated)</Label>
                  <Input
                    id="product-tags"
                    value={(editor.tags ?? []).join(",")}
                    onChange={(event) =>
                      setEditor({ ...editor, tags: event.target.value.split(",") })
                    }
                  />
                </div>
              </div>
              {formError && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {formError}
                </p>
              )}
              <div className="mt-5 flex gap-3">
                <Button type="submit" disabled={save.isPending || uploading}>
                  {save.isPending ? "Saving…" : "Save product"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={save.isPending || uploading}
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[700px] text-left text-sm">
              <caption className="sr-only">Product catalogue</caption>
              <thead className="bg-surface">
                <tr>
                  {["Product", "Price", "Stock", "Visibility", "Actions"].map((heading) => (
                    <th key={heading} scope="col" className="p-4">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => (
                  <tr key={product.id} className="border-t border-border">
                    <td className="p-4">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.category}
                        {product.featured ? " · Featured" : ""}
                      </p>
                    </td>
                    <td className="p-4">
                      {currency(product.price)}
                      {product.originalPrice > product.price && (
                        <p className="text-xs text-muted-foreground">
                          Sale · was {currency(product.originalPrice)}
                        </p>
                      )}
                    </td>
                    <td className="p-4">{product.stock}</td>
                    <td className="p-4">{product.archived ? "Archived" : "Active"}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={save.isPending || archive.isPending}
                          onClick={() => startEdit(product)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={archive.isPending || save.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `${product.archived ? "Restore" : "Archive"} ${product.name}?`,
                              )
                            )
                              archive.mutate(product);
                          }}
                        >
                          {product.archived ? "Restore" : "Archive"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && <p className="p-6 text-muted-foreground">No matching products.</p>}
          </div>
          <p className="text-xs text-muted-foreground">
            Refresh the storefront to see catalogue edits. Archived items are hidden from product
            listings and cart hydration. Historical orders keep their original item snapshots.
          </p>
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <h2 className="font-display text-xl font-semibold">Recent administrative changes</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cloud actions record the verified Cognito subject. Demo actors are not securely
            authenticated. The latest 200 changes are displayed.
          </p>
          <ul className="mt-4 space-y-3">
            {audit.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-border p-4 text-sm">
                <span className="font-semibold">{entry.action}</span> · {entry.productId}
                <p className="text-xs text-muted-foreground">
                  {formatDate(entry.at)} · {entry.actor}
                </p>
              </li>
            ))}
          </ul>
          {!audit.length && (
            <p className="mt-4 text-sm text-muted-foreground">
              Save a product to record the first change.
            </p>
          )}
        </TabsContent>
        <TabsContent value="operations" className="mt-6">
          <AdminOperations categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
