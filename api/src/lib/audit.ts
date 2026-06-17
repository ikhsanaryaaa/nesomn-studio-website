import { db } from '../db/client.ts';
import { auditLogs } from '../db/schema/index.ts';

/**
 * Catat aksi sensitif admin ke audit_logs.
 * Dipanggil oleh mutasi penting (ubah provider, atur credit, revoke sesi).
 * Gagal mencatat audit tidak boleh menggagalkan aksi utama, jadi error
 * di-log saja, bukan dilempar.
 */
export async function writeAudit(
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.insert(auditLogs).values({ actorId, action, targetType, targetId, meta });
  } catch (err) {
    console.error('[audit] gagal mencatat audit log:', err);
  }
}
