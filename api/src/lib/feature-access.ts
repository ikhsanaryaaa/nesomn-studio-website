import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { licenses, assets } from '../db/schema/index.ts';
import { effectiveSubscription } from './entitlement.ts';
import type { FeatureAccess, EditorType } from '@nesomn/shared';
const FREE_ACCESS: FeatureAccess = {
  scene2d: true,
  editor3d: false,
  proTemplates: false,
  aiVideo: false,
};
export async function getFeatureAccess(userId: string): Promise<FeatureAccess> {
  return (await effectiveSubscription(userId))?.benefits.editorAccess ?? { ...FREE_ACCESS };
}
export function editorTypeAllowed(access: FeatureAccess, editor: EditorType) {
  return editor === 'product_3d_editor' ? access.editor3d : access.scene2d;
}
export async function canUseAsset(userId: string, assetId: string) {
  const owned = await db.query.licenses.findFirst({
    where: and(eq(licenses.userId, userId), eq(licenses.assetId, assetId)),
  });
  if (owned) return true;
  const asset = await db.query.assets.findFirst({ where: eq(assets.id, assetId) });
  if (!asset || asset.status !== 'published' || !asset.isSubscriptionAsset) return false;
  const sub = await effectiveSubscription(userId);
  const access = sub?.benefits.editorAccess ?? FREE_ACCESS;
  return (
    editorTypeAllowed(access, asset.editorType) &&
    (asset.tier === 'free' || Boolean(sub?.benefits.editorAccess.proTemplates))
  );
}
