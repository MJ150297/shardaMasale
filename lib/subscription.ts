import "server-only";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";

/**
 * Plan names used across the system.
 */
export const SUBSCRIPTION_PLANS = [
  "free",
  "trial",
  "paid",
  "enterprise",
  "unlimited", // reserved for superOwner
] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trial",
  "expired",
  "suspended",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/**
 * Feature map — what each plan tier unlocks.
 * All values are conservative defaults; the super owner can override per-owner.
 */
export interface PlanFeatures {
  /** Maximum number of active shops the owner can create. */
  maxShops: number;
  /** Maximum number of items across all shops. */
  maxItems: number;
  /** Maximum number of parties (customers + suppliers) across all shops. */
  maxParties: number;
  /** Maximum number of transactions per month across all shops. */
  maxMonthlyTransactions: number;
  /** Whether advanced reports (profit/loss, export) are available. */
  advancedReports: boolean;
  /** Whether batch tracking / expiry tracking is available. */
  inventoryTracking: boolean;
  /** Whether CRM module is available. */
  crm: boolean;
  /** Whether the owner can create custom roles (admin/manager/cashier/staff). */
  customRoles: boolean;
  /** Whether API access / webhooks are available. */
  apiAccess: boolean;
  /** Whether multiple users (sub-accounts) can be invited. */
  multiUser: boolean;
  /** Maximum number of sub-users (staff accounts) the owner can create. */
  maxUsers: number;
}

const PLAN_FEATURES: Record<string, PlanFeatures> = {
  free: {
    maxShops: 1,
    maxItems: 20,
    maxParties: 20,
    maxMonthlyTransactions: 100,
    advancedReports: false,
    inventoryTracking: false,
    crm: false,
    customRoles: false,
    apiAccess: false,
    multiUser: false,
    maxUsers: 0,
  },
  trial: {
    maxShops: 1,
    maxItems: 200,
    maxParties: 100,
    maxMonthlyTransactions: 500,
    advancedReports: false,
    inventoryTracking: true,
    crm: false,
    customRoles: false,
    apiAccess: false,
    multiUser: false,
    maxUsers: 1,
  },
  paid: {
    maxShops: 5,
    maxItems: 10_000,
    maxParties: 5_000,
    maxMonthlyTransactions: 20_000,
    advancedReports: true,
    inventoryTracking: true,
    crm: true,
    customRoles: true,
    apiAccess: true,
    multiUser: true,
    maxUsers: 25,
  },
  enterprise: {
    maxShops: 100,
    maxItems: 1_000_000,
    maxParties: 500_000,
    maxMonthlyTransactions: 1_000_000,
    advancedReports: true,
    inventoryTracking: true,
    crm: true,
    customRoles: true,
    apiAccess: true,
    multiUser: true,
    maxUsers: 1_000,
  },
  unlimited: {
    maxShops: Infinity,
    maxItems: Infinity,
    maxParties: Infinity,
    maxMonthlyTransactions: Infinity,
    advancedReports: true,
    inventoryTracking: true,
    crm: true,
    customRoles: true,
    apiAccess: true,
    multiUser: true,
    maxUsers: Infinity,
  },
};

/**
 * Get the feature set for a given plan name.
 * Falls back to "free" for unknown plans.
 */
export function getPlanFeatures(plan?: string): PlanFeatures {
  return PLAN_FEATURES[plan ?? "free"] ?? PLAN_FEATURES.free;
}

/**
 * Check whether a subscription status is considered "active enough" to use the system.
 * "trial" and "active" are valid; "expired" and "suspended" are not.
 */
export function isSubscriptionActive(status?: string): boolean {
  return status === "active" || status === "trial";
}

/**
 * Result of a subscription check.
 */
export interface SubscriptionCheckResult {
  /** Whether the user's subscription is valid for use. */
  ok: boolean;
  /** Human-readable reason if not ok. */
  reason?: string;
  /** The resolved plan features. */
  features: PlanFeatures;
  /** The owner's current plan name. */
  plan: string;
  /** The owner's current subscription status. */
  status: string;
}

/**
 * Full subscription check for an owner (or any role that has a subscription).
 * - Verifies subscription status is active/trial.
 * - Verifies the associated plan features resolve.
 */
export async function checkUserSubscription(
  userId: string,
): Promise<SubscriptionCheckResult> {
  await connectToDatabase();

  const user = await User.findById(userId)
    .select("subscription")
    .lean();

  if (!user) {
    return {
      ok: false,
      reason: "User not found.",
      features: getPlanFeatures("free"),
      plan: "free",
      status: "expired",
    };
  }

  const plan = user.subscription?.plan ?? "free";
  const status = user.subscription?.status ?? "trial";
  const features = getPlanFeatures(plan);
  const active = isSubscriptionActive(status);

  return {
    ok: active,
    reason: active
      ? undefined
      : `Your subscription (${plan}) is ${status}. Please contact your administrator to renew.`,
    features,
    plan,
    status,
  };
}

/**
 * Quick guard — returns true if the user's subscription allows any shop-related operation.
 * Use this in API routes and server components that require a functional subscription.
 */
export function requireActiveSubscription(
  result: SubscriptionCheckResult,
): asserts result is SubscriptionCheckResult & { ok: true } {
  if (!result.ok) {
    const error = new Error(result.reason ?? "Subscription is not active.");
    (error as any).statusCode = 403;
    throw error;
  }
}