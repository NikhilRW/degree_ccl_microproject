/**
 * Centralized domain models for IntelliMart.
 *
 * AWS LEARNING ZONE:
 * These interfaces are intentionally the *contract* between the UI and the
 * service layer. When you later back them with Amazon DynamoDB tables
 * (Users, Products, Orders, Cart, Wishlist) keep these shapes stable so the
 * UI never needs to change.
 */

export interface Review {
  id: string;
  productId: string;
  author: string;
  avatarUrl?: string | undefined;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  userId?: string;
  status?: "pending" | "approved" | "rejected";
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryId: string;
  description: string;
  highlights: string[];
  specifications: Record<string, string>;
  images: string[];
  price: number;
  originalPrice: number;
  rating: number;
  reviewCount: number;
  stock: number;
  featured: boolean;
  createdAt: string;
  tags: string[];
  archived?: boolean;
  version?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  productCount: number;
  archived?: boolean;
  version?: number;
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  savedForLater?: boolean | undefined;
}

export interface Cart {
  items: CartItem[];
  updatedAt: string;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

export interface WishlistItem {
  productId: string;
  addedAt: string;
}

export interface Address {
  fullName: string;
  phone: string;
  address: string;
  apartment?: string | undefined;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type DeliveryMethod = "standard" | "express";

export interface Payment {
  id: string;
  method: "card" | "upi" | "cod";
  last4?: string | undefined;
  status: "pending" | "authorized" | "captured" | "failed" | "refund_pending" | "refunded";
  amount: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totals: CartTotals;
  address: Address;
  delivery: DeliveryMethod;
  payment: Payment;
  status: OrderStatus;
  createdAt: string;
  estimatedDelivery: string;
  version?: number;
  providerOrderId?: string;
  providerPaymentId?: string;
  reservationExpiresAt?: number;
  inventoryReleased?: boolean;
  customerEmail?: string;
  notificationStatus?: "pending" | "sent" | "failed";
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | undefined;
  createdAt: string;
  addresses: Address[];
  isAdmin?: boolean;
  disabled?: boolean;
}

export interface Session {
  // Real identity/provider tokens never leave the server. Kept optional for
  // compatibility with old demo data; cloud sessions use an HttpOnly cookie.
  accessToken?: string;
  expiresAt: number;
  user: User;
}

export interface ProductQuery {
  search?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: "featured" | "price-asc" | "price-desc" | "rating" | "newest";
}

export type ServiceStatus = "frontend-ready" | "integration-pending" | "code-ready" | "implemented";

export interface AwsServiceEntry {
  id: string;
  name: string;
  category: string;
  purpose: string;
  status: ServiceStatus;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  location: string;
  tasks: string[];
  docsUrl: string;
}
