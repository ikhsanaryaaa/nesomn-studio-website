import { db, sql } from './client.ts';
import { plans, creditPacks, users, type EditorAccess } from './schema/index.ts';
import { hashPassword } from '../lib/password.ts';

/**
 * Seed data awal (idempotent via onConflictDoNothing):
 * - plans (PRD §10.1)
 * - credit_packs (PRD §10.4)
 * - akun admin (kredensial dari env SEED_ADMIN_*)
 */

type PlanSeed = {
  baseCode: string;
  name: string;
  segment: 'individual' | 'team' | 'enterprise';
  monthlyIdr: number;
  monthlyUsd: number;
  yearlyIdr: number;
  yearlyUsd: number;
  creditQuota: number;
  maxSessions: number | null;
  access: EditorAccess;
  commercial: boolean;
  isEnterprise?: boolean;
};

const ACCESS = {
  freeBasic: { scene2d: true, editor3d: false, proTemplates: false, aiVideo: false },
  scene: { scene2d: true, editor3d: false, proTemplates: true, aiVideo: true },
  editor3d: { scene2d: false, editor3d: true, proTemplates: true, aiVideo: false },
  full: { scene2d: true, editor3d: true, proTemplates: true, aiVideo: true },
} satisfies Record<string, EditorAccess>;

const PLAN_SEEDS: PlanSeed[] = [
  {
    baseCode: 'free_basic',
    name: 'Free Basic',
    segment: 'individual',
    monthlyIdr: 0,
    monthlyUsd: 0,
    yearlyIdr: 0,
    yearlyUsd: 0,
    creditQuota: 0,
    maxSessions: 1,
    access: ACCESS.freeBasic,
    commercial: false,
  },
  {
    baseCode: 'scene_individual',
    name: 'Scene Editor (Individual)',
    segment: 'individual',
    monthlyIdr: 299000,
    monthlyUsd: 20,
    yearlyIdr: 239000,
    yearlyUsd: 16,
    creditQuota: 500,
    maxSessions: 1,
    access: ACCESS.scene,
    commercial: true,
  },
  {
    baseCode: 'editor3d_individual',
    name: '3D Editor (Individual)',
    segment: 'individual',
    monthlyIdr: 299000,
    monthlyUsd: 20,
    yearlyIdr: 239000,
    yearlyUsd: 16,
    creditQuota: 0,
    maxSessions: 1,
    access: ACCESS.editor3d,
    commercial: true,
  },
  {
    baseCode: 'full_individual',
    name: 'Full Access (Individual)',
    segment: 'individual',
    monthlyIdr: 449000,
    monthlyUsd: 30,
    yearlyIdr: 359000,
    yearlyUsd: 24,
    creditQuota: 500,
    maxSessions: 1,
    access: ACCESS.full,
    commercial: true,
  },
  {
    baseCode: 'scene_team',
    name: 'Scene Editor (Team/Studio)',
    segment: 'team',
    monthlyIdr: 799000,
    monthlyUsd: 45,
    yearlyIdr: 639000,
    yearlyUsd: 36,
    creditQuota: 750,
    maxSessions: 5,
    access: ACCESS.scene,
    commercial: true,
  },
  {
    baseCode: 'editor3d_team',
    name: '3D Editor (Team/Studio)',
    segment: 'team',
    monthlyIdr: 799000,
    monthlyUsd: 45,
    yearlyIdr: 639000,
    yearlyUsd: 36,
    creditQuota: 0,
    maxSessions: 5,
    access: ACCESS.editor3d,
    commercial: true,
  },
  {
    baseCode: 'full_team',
    name: 'Full Access (Team/Studio)',
    segment: 'team',
    monthlyIdr: 1199000,
    monthlyUsd: 67.5,
    yearlyIdr: 959000,
    yearlyUsd: 54,
    creditQuota: 750,
    maxSessions: 5,
    access: ACCESS.full,
    commercial: true,
  },
  {
    baseCode: 'enterprise',
    name: 'Enterprise',
    segment: 'enterprise',
    monthlyIdr: 0,
    monthlyUsd: 0,
    yearlyIdr: 0,
    yearlyUsd: 0,
    creditQuota: 0,
    maxSessions: null,
    access: ACCESS.full,
    commercial: true,
    isEnterprise: true,
  },
];

async function seedPlans() {
  const rows = PLAN_SEEDS.flatMap((p) => {
    const cycles: Array<'monthly' | 'yearly'> = ['monthly', 'yearly'];
    return cycles.map((cycle) => ({
      code: `${p.baseCode}_${cycle}`,
      name: p.name,
      segment: p.segment,
      cycle,
      priceIdr: String(cycle === 'monthly' ? p.monthlyIdr : p.yearlyIdr),
      priceUsd: String(cycle === 'monthly' ? p.monthlyUsd : p.yearlyUsd),
      creditQuota: p.creditQuota,
      maxConcurrentSessions: p.maxSessions,
      editorAccess: p.access,
      commercial: p.commercial,
      isEnterprise: p.isEnterprise ?? false,
    }));
  });

  await db.insert(plans).values(rows).onConflictDoNothing({ target: plans.code });
  console.log(`Seed plans: ${rows.length} baris diproses.`);
}

async function seedCreditPacks() {
  const packs = [
    { code: 'pack_s', name: 'Pack S', credits: 800, priceIdr: '499000', priceUsd: '30' },
    { code: 'pack_m', name: 'Pack M', credits: 1600, priceIdr: '999000', priceUsd: '60' },
    { code: 'pack_l', name: 'Pack L', credits: 3000, priceIdr: '1699000', priceUsd: '99' },
  ];
  await db.insert(creditPacks).values(packs).onConflictDoNothing({ target: creditPacks.code });
  console.log(`Seed credit_packs: ${packs.length} baris diproses.`);
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('SEED_ADMIN_EMAIL/PASSWORD belum diset, lewati seed admin.');
    return;
  }
  const passwordHash = await hashPassword(password);
  await db
    .insert(users)
    .values({ email, passwordHash, name: 'Administrator', role: 'admin', emailVerified: true })
    .onConflictDoNothing({ target: users.email });
  console.log(`Seed admin: ${email} diproses.`);
}

async function main() {
  await seedPlans();
  await seedCreditPacks();
  await seedAdmin();
  await sql.end();
  console.log('Seed selesai.');
}

main().catch((err) => {
  console.error('Seed gagal:', err);
  process.exit(1);
});
