import { and, eq, desc } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { subscriptions, plans, licenses, assets } from '../db/schema/index.ts';
import type { FeatureAccess, EditorType } from '@nesomn/shared';

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

/**
 * Petakan editorType aset ke flag akses editor pada plan.
 * scene_editor -> scene2d; product_3d_editor -> editor3d.
 */
export function editorTypeAllowed(access: FeatureAccess, editor: EditorType): boolean {
  return editor === 'product_3d_editor' ? access.editor3d : access.scene2d;
}

/**
 * Tentukan apakah user boleh memakai sebuah aset. Aturan:
 * 1. Aset yang sudah dibeli (punya license) selalu boleh, permanen, lintas
 *    subscription (marketplace one-time purchase).
 * 2. Selain itu, akses mengikuti subscription: editorType aset harus diizinkan
 *    oleh plan aktif user.
 */
export async function canUseAsset(userId: string, assetId: string): Promise<boolean> {
  const owned = await db.query.licenses.findFirst({
    where: and(eq(licenses.userId, userId), eq(licenses.assetId, assetId)),
  });
  if (owned) return true;

  const asset = await db.query.assets.findFirst({ where: eq(assets.id, assetId) });
  if (!asset) return false;

  const access = await getFeatureAccess(userId);
  return editorTypeAllowed(access, asset.editorType);
}
