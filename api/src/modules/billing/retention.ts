import { and, eq, lt, isNotNull } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { subscriptions, projects } from '../../db/schema/index.ts';

/**
 * Data retention (PRD): hapus data project user 30 hari setelah langganan
 * berakhir. Logika seleksi dipisah dari eksekusi agar dapat diuji tanpa
 * benar-benar menghapus. Akun & ledger tetap disimpan untuk audit/keuangan;
 * yang dihapus adalah konten kerja (projects).
 */

export const RETENTION_DAYS = 30;

/** Ambang waktu: langganan yang berakhir sebelum (sekarang - 30 hari). */
export function retentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Seleksi userId yang langganannya sudah berakhir lebih dari 30 hari lalu
 * dan tidak punya langganan aktif lain. Tidak menghapus apa pun.
 */
export async function selectExpiredUserIds(now: Date = new Date()): Promise<string[]> {
  const cutoff = retentionCutoff(now);

  // Langganan non-aktif yang periodenya berakhir sebelum cutoff.
  const expired = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(
      and(
        isNotNull(subscriptions.currentPeriodEnd),
        lt(subscriptions.currentPeriodEnd, cutoff),
      ),
    );

  const candidates = [...new Set(expired.map((r) => r.userId))];

  // Sisihkan user yang masih punya langganan aktif.
  const result: string[] = [];
  for (const userId of candidates) {
    const active = await db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')),
    });
    if (!active) result.push(userId);
  }
  return result;
}

/**
 * Jalankan retention: hapus projects milik user kedaluwarsa. Mengembalikan
 * jumlah user yang diproses. Dipanggil oleh script terjadwal.
 */
export async function runRetention(now: Date = new Date()): Promise<number> {
  const userIds = await selectExpiredUserIds(now);
  for (const userId of userIds) {
    await db.delete(projects).where(eq(projects.userId, userId));
  }
  return userIds.length;
}
