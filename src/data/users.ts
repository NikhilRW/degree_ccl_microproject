import type { User } from "@/types";

/** Mock user directory. AWS LEARNING ZONE: replaced by Amazon Cognito user pools. */
export const demoUser: User = {
  id: "u_demo_001",
  name: "Nikhil Wankhede",
  email: "demo@intellimart.dev",
  createdAt: "2026-01-14T08:00:00.000Z",
  addresses: [
    {
      fullName: "Nikhil Wankhede",
      phone: "+91 98200 41122",
      address: "412 Lakeview Residency, Baner Road",
      apartment: "Flat 12B",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411045",
      country: "India",
    },
  ],
};

export const users: User[] = [demoUser];
