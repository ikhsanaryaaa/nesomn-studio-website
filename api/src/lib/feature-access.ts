import { and, eq, desc } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { subscriptions, plans } from '../db/schema/index.ts';
import type { FeatureAccess } from '@nesomn/shared';

/**
 * Hitung hak akses fitur user dari plan langganan aktif. Tanpa langganan
 * aktif, user memakai akses Free Basic (scene2d saja). Sumber kebenaran
 * di server; client hanya memakai hasilnya untuk gating UI.
 */

const FREE_ACCESS: FeatureAccess = {
  scene2d: true,
  editor3d: false,
  proTemplates: false,
  aiVideo: false,
};

export async function getFeatureAccess(userId: string): Promise<FeatureAccess> {
  const sub = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')),
    orderBy: [desc(subscriptions.currentPeriodEnd)],
  });
  if (!sub) return { ...FREE_ACCESS };

  // Langganan kedaluwarsa (periode habis) dianggap Free.
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
    return { ...FREE_ACCESS };
  }

  const plan = await db.query.plans.findFirst({ where: eq(plans.id, sub.planId) });
  if (!plan) return { ...FREE_ACCESS };
  return plan.editorAccess;
}
