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
    <details className="editor-text">
      <summary className="ai-job-summary">Recover jobs from the server</summary>
      <p className="editor-hint">
        Jobs continue running when this panel is closed. Only pending jobs can be canceled; jobs
        being processed by a provider cannot be canceled here. Refreshing their status does not
        create a new job.
      </p>
      <Button variant="ghost" disabled={busy} onClick={() => void recover()}>
        {busy ? 'Loading…' : 'Load job history'}
      </Button>
      {error && <p role="alert">Unable to load job history. Try again.</p>}
      {!busy && !error && jobs.length === 0 && (
        <p className="editor-caption">No job history loaded yet.</p>
      )}
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            <Button variant="ghost" className="ai-job-action" onClick={() => onSelect(job.id)}>
              {job.id.slice(0, 8)} · {job.status}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}
