import { and, eq, asc } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { sessions, subscriptions, plans } from '../../db/schema/index.ts';

/**
 * Tentukan batas sesi aktif untuk user.
 * Ambil dari plan pada subscription aktif; default Free Basic (1) bila tak ada.
 * null = unlimited (Enterprise).
 */
export async function getMaxConcurrentSessions(userId: string): Promise<number | null> {
  const sub = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')),
  });

  if (!sub) return 1; // default Free Basic

  const plan = await db.query.plans.findFirst({ where: eq(plans.id, sub.planId) });
  if (!plan) return 1;

  return plan.maxConcurrentSessions; // bisa null = unlimited
}

/**
 * Pastikan jumlah sesi aktif tidak melebihi batas plan.
 * Bila melebihi (setelah memperhitungkan slot untuk 1 sesi baru),
 * hapus sesi terlama hingga muat.
 */
export async function enforceSessionLimit(userId: string): Promise<void> {
  const max = await getMaxConcurrentSessions(userId);
  if (max === null) return; // unlimited

  const active = await db.query.sessions.findMany({
    where: eq(sessions.userId, userId),
    orderBy: [asc(sessions.createdAt)],
  });

  // Sisakan ruang untuk satu sesi baru: pertahankan maksimal (max - 1).
  const keep = Math.max(0, max - 1);
  const toRemove = active.length - keep;
  if (toRemove <= 0) return;

  const removeIds = active.slice(0, toRemove).map((s) => s.id);
  for (const id of removeIds) {
    await db.delete(sessions).where(eq(sessions.id, id));
  }
}

/** Buat sesi baru setelah enforcement, kembalikan id sesi. */
export async function createSession(
  userId: string,
  userAgent: string | null,
  ipAddress: string | null,
): Promise<string> {
  await enforceSessionLimit(userId);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari
  const [session] = await db
    .insert(sessions)
    .values({ userId, userAgent, ipAddress, expiresAt })
    .returning({ id: sessions.id });

  return session.id;
}
