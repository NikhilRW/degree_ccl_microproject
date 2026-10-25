import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderStatusManager } from "@/components/admin/OrderStatusManager";
import { ErrorState, LoadingState } from "@/components/common/states";
import { createProductSchema, productImageMaxBytes, productImageTypes, updatePriceSchema } from "@/domain/contracts";
import { useAuth } from "@/hooks/useAuth";
import { adminService } from "@/services/admin";
import { authGeneration, isCurrentAuthGeneration, ServiceError } from "@/services/rpc";
import type { Category, Product } from "@/types";
import { currency } from "@/utils/format";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — IntelliMart" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<{ userId: string; products: Product[]; categories: Category[] } | null>(null);
  const [failure, setFailure] = useState<{ userId: string; message: string; denied: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/login", search: { redirect: "/admin" }, replace: true });
  }, [authLoading, user, navigate]);
  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setFailure(null);
    if (!user || authLoading) return;
    const userId = user.id;
    adminService.access().then(() => adminService.list()).then(data => {
      if (!cancelled) setLoaded({ userId, ...data });
    }).catch((error: unknown) => {
      if (!cancelled) setFailure({ userId, message: error instanceof Error ? error.message : "Could not load products.",
        denied: error instanceof ServiceError && error.status === 403 });
    });
    return () => { cancelled = true; };
  }, [user?.id, authLoading, retry]);
  if (authLoading || !user) return <LoadingState label="Checking sign-in" />;
  return <div className="site-container py-10 sm:py-12">
    <h1 className="font-display text-2xl font-semibold">Admin</h1>
    <p className="mt-2 text-sm text-muted-foreground">IntelliMart · Manage products, prices and order status.</p>
    {failure?.userId === user.id ? failure.denied ? <section className="mt-8 bg-surface p-6">
      <h2 className="text-lg font-semibold">Access denied</h2><p className="mt-2 text-sm">{failure.message}</p>
      <Button asChild variant="outline" className="mt-4"><Link to="/account">Your account</Link></Button>
    </section> : <div className="mt-8"><ErrorState message={failure.message} onRetry={() => setRetry(value => value + 1)} /></div>
      : loaded?.userId === user.id ? <Tabs key={user.id} defaultValue="products" className="mt-8">
        <TabsList><TabsTrigger value="products">Products</TabsTrigger><TabsTrigger value="orders">Orders</TabsTrigger></TabsList>
        <TabsContent value="products" forceMount className="data-[state=inactive]:hidden"><ProductWorkspace initialProducts={loaded.products} categories={loaded.categories} /></TabsContent>
        <TabsContent value="orders"><OrderStatusManager /></TabsContent>
      </Tabs>
        : <LoadingState label="Checking administrator access" />}
  </div>;
}

function ProductWorkspace({ initialProducts, categories }: { initialProducts: Product[]; categories: Category[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState<{ key: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const upload = async (files: File[]) => {
    const generation = authGeneration();
    setError(null); setSuccess(""); setImages([]);
    if (!files.length) { setProgress(""); return; }
    if (files.length > 6 || files.some(file => !productImageTypes.some(type => type === file.type) || file.size < 1 || file.size > productImageMaxBytes)) {
      setError("Choose 1–6 JPEG, PNG, WebP or AVIF images, each no larger than 5 MiB."); setProgress(""); return;
    }
    setUploading(true);
    const uploaded: { key: string; name: string }[] = [];
    try {
      for (const [index, file] of files.entries()) {
        if (!alive.current || !isCurrentAuthGeneration(generation)) return;
        setProgress(`Uploading image ${index + 1} of ${files.length}…`);
        const key = await adminService.uploadImage(file);
        uploaded.push({ key, name: file.name });
      }
      if (alive.current && isCurrentAuthGeneration(generation)) {
        setImages(uploaded); setProgress(`${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded.`);
      }
    } catch (error) {
      if (alive.current && isCurrentAuthGeneration(generation)) {
        setError(error instanceof Error ? error.message : "Image upload failed."); setProgress("Upload incomplete. Select the images again to retry.");
      }
    } finally { if (alive.current && isCurrentAuthGeneration(generation)) setUploading(false); }
  };
  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const parsed = createProductSchema.safeParse({
      name: fields.get("name"), categoryId, description: fields.get("description"),
      price: Number(fields.get("price")), originalPrice: fields.get("originalPrice") ? Number(fields.get("originalPrice")) : undefined,
      stock: Number(fields.get("stock")), images: images.map(image => image.key),
    });
    setError(null); setSuccess("");
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
    const generation = authGeneration(); setBusy(true);
    try {
      const product = await adminService.create(parsed.data);
      if (alive.current && isCurrentAuthGeneration(generation)) {
        setProducts(current => [product, ...current]); form.reset(); setCategoryId(""); setImages([]); setProgress("");
        setSuccess(`${product.name} was added to the shop.`);
      }
    } catch (error) {
      if (alive.current && isCurrentAuthGeneration(generation)) setError(error instanceof Error ? error.message : "Could not add the product.");
    } finally { if (alive.current && isCurrentAuthGeneration(generation)) setBusy(false); }
  };
  const shown = products.filter(product => `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase()));
  // Both columns fill the same canvas: 0.85fr + 1.15fr + one 32px gutter.
  return <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
    <section className="min-w-0 bg-surface p-5 sm:p-6" aria-labelledby="add-product">
      <h2 id="add-product" className="text-lg font-semibold">Add product</h2>
      <p className="mt-2 text-sm text-muted-foreground">Prices are in whole Indian rupees. Stock is the quantity available to order.</p>
      <form onSubmit={event => void create(event)} className="mt-6 space-y-4" aria-busy={busy || uploading}>
        <fieldset disabled={busy || uploading} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="product-name">Name</Label><Input id="product-name" name="name" required maxLength={200} /></div>
          <div className="space-y-2"><Label htmlFor="product-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required><SelectTrigger id="product-category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="product-description">Description</Label><Textarea id="product-description" name="description" required maxLength={5000} rows={4} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="product-price">Selling price (₹)</Label><Input id="product-price" name="price" type="number" min={1} max={100000000} step={1} required /></div>
            <div className="space-y-2"><Label htmlFor="product-list-price">List price (₹, optional)</Label><Input id="product-list-price" name="originalPrice" type="number" min={1} max={100000000} step={1} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="product-stock">Stock quantity</Label><Input id="product-stock" name="stock" type="number" min={0} max={1000000} step={1} required /></div>
        </fieldset>
        <div className="space-y-2"><Label htmlFor="product-images">Product images</Label>
          <Input ref={fileInput} id="product-images" type="file" multiple accept={productImageTypes.join(",")} disabled={busy || uploading}
            onChange={event => void upload(Array.from(event.target.files ?? []))} aria-describedby="image-help image-progress" />
          <p id="image-help" className="text-sm text-muted-foreground">1–6 images · JPEG, PNG, WebP or AVIF · Up to 5 MiB each. Uploads can be used for one product within an hour.</p>
          <p id="image-progress" role="status" className="text-sm">{progress}</p>
          {!!images.length && <ul className="space-y-1 text-sm">{images.map(image => <li key={image.key} className="break-words">{image.name}</li>)}</ul>}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {success && <p role="status" className="text-sm">{success}</p>}
        <Button type="submit" disabled={busy || uploading || !images.length || !categories.length}>{busy ? "Adding product…" : "Add product"}</Button>
        {!categories.length && <p className="text-sm">No existing categories are available. Ask the catalogue operator to configure them.</p>}
      </form>
    </section>
    <section className="min-w-0" aria-labelledby="product-prices">
      <h2 id="product-prices" className="text-lg font-semibold">Product prices</h2>
      <p className="mt-2 text-sm text-muted-foreground">Price changes do not change stock, reviews or past orders.</p>
      <div className="mt-4 space-y-2"><Label htmlFor="price-search">Find a product</Label><Input id="price-search" type="search" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <p className="mt-3 text-sm text-muted-foreground">{shown.length} of {products.length} products</p>
      <div className="mt-4 space-y-4">{shown.map(product => <PriceEditor key={product.id} product={product}
        onSaved={prices => setProducts(current => current.map(item => item.id === prices.productId ? { ...item, ...prices } : item))} />)}</div>
      {!shown.length && <p className="mt-4 bg-surface p-6 text-sm">{products.length ? "No products match your search." : "No products yet. Add the first product using the form."}</p>}
    </section>
  </div>;
}

function PriceEditor({ product, onSaved }: { product: Product; onSaved: (prices: { productId: string; price: number; originalPrice: number }) => void }) {
  const [price, setPrice] = useState(String(product.price));
  const [original, setOriginal] = useState(String(product.originalPrice));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const changed = Number(price) !== product.price || Number(original) !== product.originalPrice;
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setSaved(false);
    const parsed = updatePriceSchema.safeParse({ productId: product.id, price: Number(price), originalPrice: Number(original), expectedPrice: product.price, expectedOriginalPrice: product.originalPrice });
    if (!parsed.success) { setError(parsed.error.issues.map(issue => issue.message).join(" ")); return; }
    const generation = authGeneration(); setBusy(true);
    try {
      const result = await adminService.updatePrice(parsed.data);
      if (isCurrentAuthGeneration(generation)) { setSaved(true); onSaved(result); }
    } catch (error) {
      if (isCurrentAuthGeneration(generation)) setError(error instanceof ServiceError && error.status === 409 ? "This price changed elsewhere. Reload the page before editing it again." : error instanceof Error ? error.message : "Could not save the price.");
    } finally { if (isCurrentAuthGeneration(generation)) setBusy(false); }
  };
  return <form onSubmit={event => void save(event)} className="bg-surface p-5" aria-busy={busy}>
    <div className="flex items-center gap-3"><img src={product.images[0]} alt="" className="h-12 w-12 object-cover" />
      <div className="min-w-0"><h3 className="text-sm font-semibold">{product.name}</h3><p className="mt-1 text-sm text-muted-foreground">{product.category} · Current {currency(product.price)}</p></div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-4">
      <div className="space-y-2"><Label htmlFor={`price-${product.id}`}>Selling price (₹)</Label><Input id={`price-${product.id}`} type="number" min={1} max={100000000} step={1} required value={price} disabled={busy} className="text-right tabular-nums" onChange={event => setPrice(event.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor={`list-${product.id}`}>List price (₹)</Label><Input id={`list-${product.id}`} type="number" min={1} max={100000000} step={1} required value={original} disabled={busy} className="text-right tabular-nums" onChange={event => setOriginal(event.target.value)} /></div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground" role="status">{changed ? "Unsaved price changes" : saved ? "Saved" : "No changes"}</span><Button type="submit" variant="outline" disabled={busy || !changed}>{busy ? "Saving…" : "Save prices"}</Button></div>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </form>;
}
