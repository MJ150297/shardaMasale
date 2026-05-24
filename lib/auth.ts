import "server-only";
import mongoose from "mongoose";

import { cache } from "react";
import NextAuth from "next-auth";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import connectToDatabase from "@/lib/db";
import { AppError, normalizeEmail } from "@/lib/utils";
import User, { type SafeUser, type UserRole, type UserStatus } from "@/models/User";
import Settings from "@/models/Settings";
import Shop from "@/models/Shop";
import { checkUserSubscription, requireActiveSubscription, getPlanFeatures } from "@/lib/subscription";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const DEFAULT_MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_ERROR_PREFIX = "LOCKED_UNTIL:";

// Cache security settings for 10 minutes
let cachedSettings: { maxLoginAttempts: number; timestamp: number } | null = null;
const SETTINGS_CACHE_TTL_MS = 10 * 60 * 1000;

export type AppSessionUser = SafeUser & {
  role: UserRole;
  status: UserStatus;
  timezone: string;
  currency: string;
  activeShopId?: string | null;
  subscription?: {
    plan: string;
    status: string;
    expiryDate?: string | null;
    trialEndsAt?: string | null;
  } | null;
};

export type AppSession = Omit<Session, "user"> & {
  user: AppSessionUser;
};

type AuthenticatedUserPayload = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  timezone: string;
  currency: string;
  belongsTo?: string | null;
};

export type AuthenticatedToken = JWT & {
  role?: UserRole;
  status?: UserStatus;
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
};

function getLockoutExpiresAt(referenceTimeMs: number): Date {
  return new Date(referenceTimeMs + LOGIN_LOCKOUT_WINDOW_MS);
}

function buildLockoutError(expiresAt: Date): Error {
  return new Error(`${LOCKOUT_ERROR_PREFIX}${expiresAt.toISOString()}`);
}

function getAuthSecret(): string {
  if (process.env.NEXTAUTH_SECRET?.trim()) {
    return process.env.NEXTAUTH_SECRET;
  }

  if (process.env.AUTH_SECRET?.trim()) {
    return process.env.AUTH_SECRET;
  }

  if (process.env.NODE_ENV !== "production") {
    return "gsms-development-secret-change-me";
  }

  throw new AppError("NEXTAUTH_SECRET must be configured in production.", 500);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getAuthSecret(),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 days, matching session.maxAge
      },
    },
  },
  pages: {
    signIn: "/signin",
  },
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "owner@business.com",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(rawCredentials) {
        const parsedCredentials = credentialsSchema.safeParse(rawCredentials);

        if (!parsedCredentials.success) {
          return null;
        }

        await connectToDatabase();

        const user = await User.findOne({
          email: normalizeEmail(parsedCredentials.data.email),
          status: "active",
        }).select("+passwordHash +loginAttempts +lastFailedLoginAt +lastLoginAt");

        if (!user) {
          return null;
        }

        // Check login attempts lockout
        const settings = await Settings.findOne({ owner: user._id }).select("security.maxLoginAttempts").lean();
        const maxAttempts =
          settings?.security.maxLoginAttempts ?? DEFAULT_MAX_LOGIN_ATTEMPTS;
        const lastFailedLoginAt = user.lastFailedLoginAt?.getTime() ?? 0;
        const isLockoutActive =
          user.loginAttempts >= maxAttempts &&
          Date.now() - lastFailedLoginAt < LOGIN_LOCKOUT_WINDOW_MS;

        if (isLockoutActive) {
          throw buildLockoutError(getLockoutExpiresAt(lastFailedLoginAt));
        }

        if (user.loginAttempts >= maxAttempts) {
          await User.findByIdAndUpdate(user._id, {
            $set: {
              loginAttempts: 0,
              lastFailedLoginAt: null,
            },
          });
        }

        const isValidPassword = await user.comparePassword(
          parsedCredentials.data.password,
        );

        if (!isValidPassword) {
          const failedAt = Date.now();
          const nextLoginAttempts = user.loginAttempts + 1;

          await User.findByIdAndUpdate(user._id, {
            $inc: { loginAttempts: 1 },
            $set: { lastFailedLoginAt: new Date(failedAt) },
          });

          if (nextLoginAttempts >= maxAttempts) {
            throw buildLockoutError(getLockoutExpiresAt(failedAt));
          }

          return null;
        }

        await User.findByIdAndUpdate(user._id, {
          $set: {
            lastLoginAt: new Date(),
            lastFailedLoginAt: null,
            loginAttempts: 0,
          },
        });

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          timezone: user.timezone,
          currency: user.currency,
          belongsTo: user.belongsTo?.toString() ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const nextToken = token as AuthenticatedToken;

      // Handle session updates (e.g., shop switching via update())
      if (trigger === "update" && session?.activeShopId) {
        nextToken.activeShopId = session.activeShopId;
        return nextToken;
      }

      if (user) {
        const authenticatedUser = user as unknown as AuthenticatedUserPayload & { belongsTo?: string | null };

        nextToken.sub = authenticatedUser.id;
        nextToken.name = authenticatedUser.name;
        nextToken.email = authenticatedUser.email;
        nextToken.role = authenticatedUser.role;
        nextToken.status = authenticatedUser.status;
        nextToken.timezone = authenticatedUser.timezone;
        nextToken.currency = authenticatedUser.currency;
        nextToken.belongsTo = authenticatedUser.belongsTo ?? null;
        
        // Load subscription info for owners and business users
        if (nextToken.role && nextToken.role !== 'customer' && nextToken.role !== 'superOwner') {
          const userRecord = await User.findById(nextToken.sub).select('subscription').lean();
          if (userRecord?.subscription) {
            nextToken.subscription = {
              plan: userRecord.subscription.plan ?? 'free',
              status: userRecord.subscription.status ?? 'trial',
              expiryDate: userRecord.subscription.expiryDate?.toISOString?.() ?? null,
              trialEndsAt: userRecord.subscription.trialEndsAt?.toISOString?.() ?? null,
            };
          } else {
            nextToken.subscription = { plan: 'free', status: 'trial', expiryDate: null, trialEndsAt: null };
          }

          // Load user shops and set default active shop
          const shops = await Shop.find({ ownerId: nextToken.sub, isActive: true }).select('_id name').lean();
          
          if (shops.length > 0) {
            nextToken.activeShopId = shops[0]._id.toString();
          }
        } else if (nextToken.role === 'customer') {
          const userRecord = await User.findById(nextToken.sub).select('subscription').lean();
          if (userRecord?.subscription) {
            nextToken.subscription = {
              plan: userRecord.subscription.plan ?? 'free',
              status: userRecord.subscription.status ?? 'trial',
              expiryDate: userRecord.subscription.expiryDate?.toISOString?.() ?? null,
              trialEndsAt: userRecord.subscription.trialEndsAt?.toISOString?.() ?? null,
            };
          }
        }
      }

      return nextToken;
    },
    async session({ session, token }) {
      const nextSession = session as AppSession;

      nextSession.user = {
        id: token.sub ?? "",
        name: token.name ?? "",
        email: token.email ?? "",
        role: (token as AuthenticatedToken).role ?? "staff",
        status: (token as AuthenticatedToken).status ?? "inactive",
        timezone: (token as AuthenticatedToken).timezone ?? "Asia/Kolkata",
        currency: (token as AuthenticatedToken).currency ?? "INR",
        belongsTo: (token as AuthenticatedToken).belongsTo ?? null,
        activeShopId: (token as AuthenticatedToken).activeShopId ?? null,
        subscription: (token as AuthenticatedToken).subscription ?? null,
      };

      return nextSession;
    },
  },
});

export const getServerAuthSession = cache(async (): Promise<AppSession | null> => {
  const session = await auth();
  return session as AppSession | null;
});

export const requireUser = cache(async (): Promise<AppSessionUser> => {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  return session.user as AppSessionUser;
});

export const requireOwner = cache(async (): Promise<AppSessionUser> => {
  const user = await requireUser();

  if (user.role !== "owner") {
    notFound();
  }

  return user;
});

export const requireCustomer = cache(async (): Promise<AppSessionUser> => {
  const user = await requireUser();

  if (user.role !== "customer") {
    notFound();
  }

  return user;
});

export const requireSuperOwner = cache(async (): Promise<AppSessionUser> => {
  const user = await requireUser();

  if (user.role !== "superOwner") {
    notFound();
  }

  return user;
});

export const requireBusinessUser = cache(async (): Promise<AppSessionUser> => {
  const user = await requireUser();

  if (user.role === "customer") {
    notFound();
  }

  return user;
});

/**
 * Require that the authenticated user has an active (or trial) subscription.
 * Only checks business users (owner/admin/manager/cashier/staff).
 * SuperOwner bypasses this check.
 */
export const requireActiveBusinessSubscription = cache(async (): Promise<{
  user: AppSessionUser;
  subscription: { plan: string; status: string };
  features: import("@/lib/subscription").PlanFeatures;
}> => {
  const user = await requireUser();

  // Super owner is always allowed
  if (user.role === "superOwner") {
    return {
      user,
      subscription: { plan: "unlimited", status: "active" },
      features: getPlanFeatures("unlimited"),
    };
  }

  // Customers don't need a subscription check here
  if (user.role === "customer") {
    return {
      user,
      subscription: { plan: "free", status: "active" },
      features: getPlanFeatures("free"),
    };
  }

  const result = await checkUserSubscription(user.id);
  requireActiveSubscription(result);

  return {
    user,
    subscription: { plan: result.plan, status: result.status },
    features: result.features,
  };
});