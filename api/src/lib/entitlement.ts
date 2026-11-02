import { and, eq, inArray, desc, gt, lte } from 'drizzle-orm';
import { db } from '../db/client.ts';
import type { Tx } from '../db/transaction.ts';
import { plans, subscriptions } from '../db/schema/index.ts';

/** Use the existing Pro capability; a Free Basic subscription row is still Free. */
export function subscriptionTier(
  sub: { benefits: { editorAccess: { proTemplates: boolean } } } | null,
): 'free' | 'pro' {
  return sub?.benefits.editorAccess.proTemplates ? 'pro' : 'free';
}

/** Canceled renewals retain access until the paid period ends. Null dates grant nothing. */
export async function effectiveSubscription(
  userId: string,
  now = new Date(),
  connection: Tx | typeof db = db,
) {
  const sub = await connection.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      inArray(subscriptions.status, ['active', 'canceled']),
      lte(subscriptions.currentPeriodStart, now),
      gt(subscriptions.currentPeriodEnd, now),
    ),
    orderBy: [desc(subscriptions.currentPeriodEnd), desc(subscriptions.createdAt)],
  });
  if (!sub) return null;
  const plan = await connection.query.plans.findFirst({ where: eq(plans.id, sub.planId) });
  if (!plan) return null;
  return {
    ...sub,
    managedBenefits: Boolean(sub.benefits),
    benefits: sub.benefits ?? {
      creditQuota: 0,
      maxConcurrentSessions: plan.maxConcurrentSessions,
      editorAccess: plan.editorAccess,
      code: plan.code,
    },
  };
}
