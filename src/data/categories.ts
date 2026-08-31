import type { Category } from "@/types";

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

export const categories: Category[] = [
  { id: "electronics", name: "Electronics", slug: "electronics", description: "Audio, cameras and everyday tech.", image: img("photo-1498049794561-7780e7231661"), productCount: 4 },
  { id: "computing", name: "Computing", slug: "computing", description: "Monitors, storage and desk gear.", image: img("photo-1517336714731-489689fd1ca8"), productCount: 4 },
  { id: "home", name: "Home & Living", slug: "home", description: "Make your space smarter.", image: img("photo-1493809842364-78817add7ffb"), productCount: 3 },
  { id: "fashion", name: "Fashion", slug: "fashion", description: "Wearables with a clean edge.", image: img("photo-1483985988355-763728e1935b"), productCount: 2 },
  { id: "accessories", name: "Accessories", slug: "accessories", description: "The small things that matter.", image: img("photo-1553062407-98eeb64c6a62"), productCount: 3 },
  { id: "gaming", name: "Gaming", slug: "gaming", description: "Gear built for reaction time.", image: img("photo-1542751371-adc38448a05e"), productCount: 3 },
  { id: "books", name: "Books", slug: "books", description: "Engineering, design and business.", image: img("photo-1512820790803-83ca734da794"), productCount: 1 },
  { id: "smart", name: "Smart Devices", slug: "smart", description: "Connected devices for every room.", image: img("photo-1558089687-f282ffcbc126"), productCount: 3 },
];
