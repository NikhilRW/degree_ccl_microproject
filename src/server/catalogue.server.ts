import { randomUUID } from "node:crypto";
import type { Category, Product, Review } from "@/types";
import { productEditSchema, archiveProductSchema, type ProductEdit } from "@/services/admin/schema";
import { change, getRecords, auditChange } from "./records.server";

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  productId: string;
}
export function getCatalogueStore() {
  const records = getRecords();
  return {
    async snapshot(includeAudit = true) {
      const [productRows, categoryRows, reviewRows, auditPage] = await Promise.all([
        records.list<Product>("PRODUCT"),
        records.list<Category>("CATEGORY"),
        records.list<Review>("REVIEW"),
        includeAudit
          ? records.page<AuditEntry>("AUDIT", "", 200, true)
          : Promise.resolve({ rows: [], cursor: "" }),
      ]);
      const categories = categoryRows.map((row) => ({
        ...row.value,
        productCount: productRows.filter(
          (product) => !product.value.archived && product.value.categoryId === row.id,
        ).length,
      }));
      const reviews = reviewRows.map((row) => row.value);
      const products = productRows.map((row) => {
        const approved = reviews.filter(
          (review) => review.productId === row.id && review.status === "approved",
        );
        return {
          ...row.value,
          category:
            categories.find((category) => category.id === row.value.categoryId)?.name ??
            row.value.category,
          rating: approved.length
            ? Math.round(
                (approved.reduce((sum, review) => sum + review.rating, 0) / approved.length) * 10,
              ) / 10
            : 0,
          reviewCount: approved.length,
        };
      });
      return {
        products,
        categories,
        reviews,
        audit: auditPage.rows
          .map((row) => row.value)
          .sort((a, b) => b.at.localeCompare(a.at))
          .slice(0, 200),
      };
    },
    async upsert(raw: ProductEdit, actor = "demo-operator") {
      const input = productEditSchema.parse(raw);
      const category = await records.get<Category>("CATEGORY", input.categoryId);
      if (!category || category.value.archived) throw new Error("Choose an active category.");
      const existing = input.id ? await records.get<Product>("PRODUCT", input.id) : null;
      if (input.id && !existing) throw new Error("Product not found.");
      if (existing && (existing.value.version ?? 0) !== input.expectedVersion)
        throw new Error("This product changed. Refresh before saving.");
      const slugRecord = await records.get<{ productId: string }>("PRODUCT_SLUG", input.slug);
      const duplicate = (await records.list<Product>("PRODUCT")).find(
        (row) => row.value.slug === input.slug && row.id !== existing?.id,
      );
      if (duplicate || (slugRecord && slugRecord.value.productId !== existing?.id))
        throw new Error("A product already uses this slug.");
      const product: Product = {
        id: existing?.id ?? `p_${randomUUID()}`,
        name: input.name,
        slug: input.slug,
        category: category.value.name,
        categoryId: category.id,
        description: input.description,
        images: [
          input.imageUrl,
          ...(input.additionalImages ?? existing?.value.images.slice(1) ?? []),
        ],
        highlights: input.highlights ?? existing?.value.highlights ?? [],
        specifications: input.specifications ?? existing?.value.specifications ?? {},
        price: input.price,
        originalPrice: input.originalPrice,
        stock: input.stock,
        featured: input.featured,
        rating: existing?.value.rating ?? 0,
        reviewCount: existing?.value.reviewCount ?? 0,
        createdAt: existing?.value.createdAt ?? new Date().toISOString(),
        tags: input.tags ?? existing?.value.tags ?? [category.id],
        version: (existing?.value.version ?? 0) + 1,
        archived: existing?.value.archived ?? false,
      };
      const changes = [
        change("PRODUCT", product.id, existing, product),
        change("PRODUCT_SLUG", product.slug, slugRecord, { productId: product.id }),
        auditChange(actor, existing ? "product.updated" : "product.created", product.id),
      ];
      if (existing && existing.value.slug !== product.slug) {
        const oldSlug = await records.get("PRODUCT_SLUG", existing.value.slug);
        if (oldSlug) changes.push(change("PRODUCT_SLUG", existing.value.slug, oldSlug, null));
      }
      // Check the category revision too so a concurrent archive cannot orphan a product.
      changes.push(change("CATEGORY", category.id, category, category.value));
      await records.transaction(changes);
      return product;
    },
    async archive(raw: unknown, actor = "demo-operator") {
      const input = archiveProductSchema.parse(raw);
      const row = await records.get<Product>("PRODUCT", input.id);
      if (!row) throw new Error("Product not found.");
      if ((row.value.version ?? 0) !== input.expectedVersion)
        throw new Error("This product changed. Refresh before saving.");
      const changes = [
        change("PRODUCT", row.id, row, {
          ...row.value,
          archived: input.archived,
          version: (row.value.version ?? 0) + 1,
        }),
        auditChange(actor, input.archived ? "product.archived" : "product.restored", row.id),
      ];
      if (!input.archived) {
        const category = await records.get<Category>("CATEGORY", row.value.categoryId);
        if (!category || category.value.archived)
          throw new Error("Restore the product's category first.");
        changes.push(change("CATEGORY", category.id, category, category.value));
      }
      await records.transaction(changes);
    },
  };
}
