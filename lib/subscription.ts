import "server-only";
import connectToDatabase from "@/lib/db";
import User from "@/models/User";
import { getPlanFeatures } from "@/lib/subscription-features";
import type { PlanFeatures } from "@/lib/subscription-features";
export {
  ADVANCED_REPORT_SLUGS,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUSES,
  getPlanFeatures,
  isAdvancedReport,
} from "@/lib/subscription-features";

export type {
  PlanFeatures,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/lib/subscription-features";

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
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }
}
