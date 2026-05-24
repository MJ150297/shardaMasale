import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   */
  interface User {
    role: string;
    status: string;
    timezone: string;
    currency: string;
    belongsTo?: string | null;
  }

  /**
   * Returned by `useSession`, `getSession`, `auth()` and received as a prop on the `SessionProvider` React Context
   */
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

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `auth()`, when using JWT sessions */
  interface JWT {
    role?: string;
    status?: string;
    timezone?: string;
    currency?: string;
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