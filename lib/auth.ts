import "server-only";
import mongoose from "mongoose";

import { cache } from "react";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession, type NextAuthOptions } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import connectToDatabase from "@/lib/db";
import { AppError, normalizeEmail } from "@/lib/utils";
import User, { type SafeUser, type UserRole, type UserStatus } from "@/models/User";
import Settings from "@/models/Settings";
import Shop from "@/models/Shop";

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

  if (process.env.NODE_ENV !== "production") {
    return "gsms-development-secret-change-me";
  }

  throw new AppError("NEXTAUTH_SECRET must be configured in production.", 500);
}

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 15,
  },
  pages: {
    signIn: "/signin",
  },
  providers: [
    CredentialsProvider({
      name: "Email and Password",
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
    async jwt({ token, user }) {
      const nextToken = token as AuthenticatedToken;

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
        
        // Load user shops and set default active shop
        if (nextToken.role && nextToken.role !== 'customer' && nextToken.role !== 'superOwner') {
          const shops = await Shop.find({ ownerId: nextToken.sub, isActive: true }).select('_id name').lean();
          
          if (shops.length > 0) {
            nextToken.activeShopId = shops[0]._id.toString();
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
      };

      return nextSession;
    },
  },
};

export const getServerAuthSession = cache(async (): Promise<AppSession | null> => {
  const session = await getServerSession(authOptions);
  return session as AppSession | null;
});

export const requireUser = cache(async (): Promise<AppSessionUser> => {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/signin");
  }

  return session.user;
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
