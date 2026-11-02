import { useState } from 'react';
import { api } from '@/lib/api';
import type { AiJobDTO, AiTab } from '@nesomn/shared';
import { Button } from '@/components/ui/button';

/** Recovery only reads jobs owned by the authenticated user. Never resubmits a job. */
export function JobRecovery({ tab, onSelect }: { tab: AiTab; onSelect: (id: string) => void }) {
  const [jobs, setJobs] = useState<AiJobDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function recover() {
    setBusy(true);
    setError(false);
    try {
      setJobs((await api.ai.listJobs()).filter((job) => job.tab === tab));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="text-sm">
      <summary className="min-h-11 cursor-pointer py-3">Pulihkan job dari server</summary>
      <p className="text-xs text-muted-foreground">
        Job tetap berjalan saat panel ditutup. Pembatalan hanya untuk job pending; job yang diproses
        provider tidak dapat dibatalkan melalui panel ini. Memuat ulang status tidak membuat job
        baru.
      </p>
      <Button variant="ghost" disabled={busy} onClick={() => void recover()}>
        {busy ? 'Memuat...' : 'Muat riwayat job'}
      </Button>
      {error && <p role="alert">Riwayat gagal dimuat. Coba lagi.</p>}
      {!busy && !error && jobs.length === 0 && <p className="text-xs">Belum ada riwayat dimuat.</p>}
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onSelect(job.id)}
            >
              {job.id.slice(0, 8)} · {job.status}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
