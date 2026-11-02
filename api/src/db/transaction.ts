import { eq } from 'drizzle-orm';
import { db } from './client.ts';
import { users } from './schema/auth.ts';
import { AppError } from '../middleware/error.ts';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Stable lock, including users who have no ledger/session/job rows yet. */
export async function lockUser(tx: Tx, userId: string) {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
  if (!user) throw new AppError('FORBIDDEN', 'Akun tidak tersedia.', 403);
  return user;
}

export function withUserTransaction<T>(userId: string, run: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    return run(tx);
  });
}
