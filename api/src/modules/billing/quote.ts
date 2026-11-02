import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { plans, creditPacks, assets } from '../../db/schema/index.ts';
import { AppError } from '../../middleware/error.ts';
import { computeBundlePrice } from '../catalog/pricing.ts';
export const checkoutBody = z.object({
  type: z.enum(['asset', 'bundle', 'topup', 'subscription']),
  gateway: z.enum(['qris', 'pakasir', 'stripe', 'stub']).default('qris'),
  planId: z.string().uuid().optional(),
  creditPackId: z.string().uuid().optional(),
  assetIds: z
    .array(z.string().uuid())
    .min(1)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length)
    .optional(),
});

/** Susun order + item berdasarkan tipe; harga dari DB (server-side). */
export async function buildOrder(input: z.infer<typeof checkoutBody>) {
  if (input.type === 'subscription') {
    if (!input.planId)
      throw new AppError('BAD_REQUEST', 'planId is required for a subscription.', 400);
    const plan = await db.query.plans.findFirst({ where: eq(plans.id, input.planId) });
    if (!plan) throw new AppError('NOT_FOUND', 'Plan not found.', 404);
    if (plan.isEnterprise) throw new AppError('BAD_REQUEST', 'Enterprise via Contact Sales.', 400);
    return {
      amountIdr: Number(plan.priceIdr),
      amountUsd: Number(plan.priceUsd),
      description: `Subscription ${plan.name}`,
      items: [
        {
          refType: 'plan',
          refId: plan.id,
          unitIdr: plan.priceIdr,
          unitUsd: plan.priceUsd,
          snapshot: {
            creditQuota: plan.creditQuota,
            maxConcurrentSessions: plan.maxConcurrentSessions,
            editorAccess: plan.editorAccess,
            code: plan.code,
            cycle: plan.cycle,
            segment: plan.segment,
          },
        },
      ],
    };
  }
  if (input.type === 'topup') {
    if (!input.creditPackId) throw new AppError('BAD_REQUEST', 'creditPackId is required.', 400);
    const pack = await db.query.creditPacks.findFirst({
      where: eq(creditPacks.id, input.creditPackId),
    });
    if (!pack || !pack.enabled) throw new AppError('NOT_FOUND', 'Credit pack unavailable.', 404);
    return {
      amountIdr: Number(pack.priceIdr),
      amountUsd: Number(pack.priceUsd),
      description: `Top-up ${pack.name} (${pack.credits} credit)`,
      items: [
        {
          refType: 'credit_pack',
          refId: pack.id,
          unitIdr: pack.priceIdr,
          unitUsd: pack.priceUsd,
          snapshot: { credits: pack.credits },
        },
      ],
    };
  }
  // asset / bundle
  if (!input.assetIds?.length) throw new AppError('BAD_REQUEST', 'assetIds is required.', 400);
  const rows = await db.query.assets.findMany({ where: inArray(assets.id, input.assetIds) });
  if (
    rows.length !== input.assetIds.length ||
    rows.some((a) => a.status !== 'published' || !a.isMarketplace)
  )
    throw new AppError('NOT_FOUND', 'Some assets were not found.', 404);
  const price = computeBundlePrice(
    rows.map((a) => ({ id: a.id, priceIdr: Number(a.priceIdr), priceUsd: Number(a.priceUsd) })),
  );
  return {
    amountIdr: price.totalIdr,
    subtotalIdr: price.subtotalIdr,
    discountIdr: price.discountIdr,
    amountUsd: price.totalUsd,
    description: input.type === 'bundle' ? `Bundle ${rows.length} assets` : rows[0].title,
    items: rows.map((a) => ({
      refType: 'asset',
      refId: a.id,
      unitIdr: a.priceIdr,
      unitUsd: a.priceUsd,
      snapshot: { fileKey: a.fileKey ?? a.glbFile },
    })),
  };
}
