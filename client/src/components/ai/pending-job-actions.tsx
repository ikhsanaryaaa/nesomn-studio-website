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
    setBusy(true);
    setError('');
    try {
      await api.ai.cancelJob(job.id);
    } catch (e) {
      setError(
        e instanceof ApiRequestError
          ? e.message
          : 'The cancellation could not be verified. Refresh the job status before trying again.',
      );
    } finally {
      await qc.invalidateQueries({ queryKey: ['ai-job', job!.id] });
      await qc.invalidateQueries({ queryKey: ['ai-credit'] });
      setBusy(false);
    }
  }
  return (
    <div className="editor-text">
      {job?.status === 'pending' && (
        <Button variant="secondary" disabled={busy} onClick={() => void cancel()}>
          {busy ? 'Checking…' : 'Cancel pending job'}
        </Button>
      )}
      {job?.status === 'processing' && (
        <p role="status">Processing. Provider cancellation is unavailable.</p>
      )}
      {job?.needsReview && (
        <p role="status">
          This job needs administrator reconciliation. Do not resubmit it until its status has been
          checked.
        </p>
      )}
      {error && (
        <p role="alert" className="editor-danger">
          {error}
        </p>
      )}
    </div>
  );
}
