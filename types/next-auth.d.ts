import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      status: string;
      timezone: string;
      currency: string;
      belongsTo?: string | null;
      activeShopId?: string | null;
      subscription?: {
        plan: string;
        status: string;
        expiryDate?: string | null;
        trialEndsAt?: string | null;
      } | null;
    }
  }
}
