import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiRequestError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { AiJobDTO } from '@nesomn/shared';

export function PendingJobActions({ job }: { job: AiJobDTO | null }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function cancel() {
    if (!job || busy) return;
    setBusy(true); setError('');
    try { await api.ai.cancelJob(job.id); }
    catch (e) { setError(e instanceof ApiRequestError ? e.message : 'Pembatalan belum dapat diverifikasi. Muat ulang status sebelum mencoba lagi.'); }
    finally {
      await qc.invalidateQueries({queryKey:['ai-job', job!.id]});
      await qc.invalidateQueries({queryKey:['ai-credit']});
      setBusy(false);
    }
  }
  return <div className="text-sm">
    {job?.status === 'pending' && <Button variant="secondary" disabled={busy} onClick={() => void cancel()}>{busy ? 'Memeriksa...' : 'Batalkan job pending'}</Button>}
    {job?.status === 'processing' && <p role="status">Sedang diproses. Pembatalan provider tidak tersedia.</p>}
    {job?.needsReview && <p role="status">Job perlu rekonsiliasi admin. Jangan kirim ulang sebelum status diperiksa.</p>}
    {error && <p role="alert" className="text-danger">{error}</p>}
  </div>;
}
