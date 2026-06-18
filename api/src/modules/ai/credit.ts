import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { creditLedger } from '../../db/schema/index.ts';

/**
 * Helper credit server-side untuk AI System (AI-RULES §4: hitung di server).
 * Saldo = balanceAfter entri ledger terbaru. Potong saat job dibuat
 * (reason 'usage'), refund saat job gagal (reason 'refund'). Semua mutasi
 * memakai transaksi + row lock agar konsisten saat job paralel.
 */

/** Saldo credit terkini user (0 bila belum ada entri). */
export async function getBalance(userId: string): Promise<number> {
  const [last] = await db
    .select({ balance: creditLedger.balanceAfter })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(1);
  return last?.balance ?? 0;
}

/**
 * Potong credit user sebesar amount. Melempar bila saldo tidak cukup.
 * Mengembalikan saldo setelah potong. amount harus > 0.
 */
export async function deductCredit(
  userId: string,
  amount: number,
  refId: string,
): Promise<number> {
  if (amount <= 0) throw new Error('Jumlah potong credit harus > 0.');
  return db.transaction(async (tx) => {
    // Kunci baris ledger user agar pembacaan saldo konsisten antar job paralel.
    const [last] = await tx
      .select({ balance: creditLedger.balanceAfter })
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId))
      .orderBy(desc(creditLedger.createdAt))
      .limit(1)
      .for('update');
    const current = last?.balance ?? 0;
    if (current < amount) {
      throw new Error('Saldo credit tidak cukup.');
    }
    const balanceAfter = current - amount;
    await tx.insert(creditLedger).values({
      userId,
      delta: -amount,
      reason: 'usage',
      refType: 'ai_job',
      refId,
      balanceAfter,
    });
    return balanceAfter;
  });
}

/**
 * Kembalikan (refund) credit user sebesar amount, mis. saat job gagal.
 * Idempotensi sederhana: lewati bila sudah ada refund untuk refId ini.
 */
export async function refundCredit(
  userId: string,
  amount: number,
  refId: string,
): Promise<number> {
  if (amount <= 0) return getBalance(userId);
  return db.transaction(async (tx) => {
    // Cegah refund ganda untuk job yang sama.
    const [existing] = await tx
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(
        sql`${creditLedger.userId} = ${userId} and ${creditLedger.refType} = 'ai_job' and ${creditLedger.refId} = ${refId} and ${creditLedger.reason} = 'refund'`,
      )
      .limit(1);
    if (existing) {
      const [last] = await tx
        .select({ balance: creditLedger.balanceAfter })
        .from(creditLedger)
        .where(eq(creditLedger.userId, userId))
        .orderBy(desc(creditLedger.createdAt))
        .limit(1);
      return last?.balance ?? 0;
    }

    const [last] = await tx
      .select({ balance: creditLedger.balanceAfter })
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId))
      .orderBy(desc(creditLedger.createdAt))
      .limit(1)
      .for('update');
    const current = last?.balance ?? 0;
    const balanceAfter = current + amount;
    await tx.insert(creditLedger).values({
      userId,
      delta: amount,
      reason: 'refund',
      refType: 'ai_job',
      refId,
      balanceAfter,
    });
    return balanceAfter;
  });
}
