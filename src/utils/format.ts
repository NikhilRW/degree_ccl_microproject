export const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

export const discountPercent = (price: number, original: number) =>
  original > price ? Math.round(((original - price) / original) * 100) : 0;

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const stockLabel = (stock: number) =>
  stock === 0 ? "Out of stock" : stock <= 10 ? `Only ${stock} left` : "In stock";
