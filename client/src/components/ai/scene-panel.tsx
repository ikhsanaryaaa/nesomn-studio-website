import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Loader2, Download, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { PendingJobActions } from './pending-job-actions';
import { JobRecovery } from './job-recovery';
import { CreditBadge } from './credit-badge';
import { api, ApiRequestError } from '@/lib/api';
import { useAiJob } from '@/hooks/use-ai-job';
import type { AiAspect } from '@nesomn/shared';

/**
 * Panel Scene (image-to-image): pilih model, prompt, aspect, lalu Generate.
 * Status job di-polling sampai selesai. Hasil dapat ditarik ke canvas
 * lewat callback onApplyResult.
 */

const ASPECTS: AiAspect[] = ['1:1', '4:3', '3:4', '16:9', '9:16'];

type Props = {
  /** Dipanggil saat user menarik hasil image ke canvas editor. */
  onApplyResult?: (url: string) => void;
};

export function ScenePanel({ onApplyResult }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modelId, setModelId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<AiAspect>('1:1');
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const models = useQuery({
    queryKey: ['ai-models', 'scene'],
    queryFn: () => api.ai.models('scene'),
  });

  const selectedModel = models.data?.find((m) => m.id === modelId) ?? models.data?.[0];
  const { job, isPending, isDone, isFailed, error, retry } = useAiJob(jobId);

  async function handleGenerate() {
    if (submitting || isPending) return;
    if (!selectedModel || models.isError) {
      toast({ title: 'Choose a model first', variant: 'danger' });
      return;
    }
    if (!prompt.trim()) {
      toast({ title: 'Enter a prompt', variant: 'danger' });
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.ai.createJob({
        providerId: selectedModel.id,
        tab: 'scene',
        input: { prompt, aspect },
      });
      setJobId(created.id);
      qc.invalidateQueries({ queryKey: ['ai-credit'] });
      toast({ title: 'Job created', description: 'Waiting for generation results…' });
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Unable to create the job.';
      toast({ title: 'Unable to generate', description: msg, variant: 'danger' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="editor-tool-panel">
      <div className="editor-panel-heading">
        <h3 className="editor-panel-title">AI Scene</h3>
        <CreditBadge cost={selectedModel?.creditCost} />
      </div>

      <div className="editor-field">
        <label htmlFor="ai-scene-model" className="editor-field-label">
          Model
        </label>
        <select
          id="ai-scene-model"
          value={selectedModel?.id ?? ''}
          onChange={(e) => setModelId(e.target.value)}
          className="editor-model-select"
        >
          {models.isLoading && <option>Loading…</option>}
          {models.data?.length === 0 && <option value="">No models available</option>}
          {models.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.modelName} ({m.creditCost} credit)
            </option>
          ))}
        </select>
      </div>

      <div className="editor-field">
        <label htmlFor="ai-scene-prompt" className="editor-field-label">
          Prompt
        </label>
        <Input
          id="ai-scene-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the result you want"
        />
      </div>

      <div className="editor-field">
        <label className="editor-field-label">Aspect ratio</label>
        <div className="editor-option-row">
          {ASPECTS.map((a) => (
            <Button
              key={a}
              size="sm"
              variant={aspect === a ? 'primary' : 'ghost'}
              onClick={() => setAspect(a)}
            >
              {a}
            </Button>
          ))}
        </div>
      </div>

      <Button
        id="ai-scene-generate"
        onClick={handleGenerate}
        disabled={submitting || isPending || !selectedModel || models.isError}
      >
        {isPending ? (
          <Loader2 className="editor-loading-icon" />
        ) : (
          <Sparkles className="editor-action-icon" />
        )}
        {isPending ? 'Generating...' : 'Generate'}
      </Button>

      {/* Hasil */}
      {models.isError && (
        <p role="alert" className="editor-error">
          Unable to load models.{' '}
          <Button variant="ghost" onClick={() => void models.refetch()}>
            Try again
          </Button>
        </p>
      )}
      {error && (
        <p role="alert" className="editor-error">
          The job status could not be verified.{' '}
          <Button variant="ghost" onClick={() => void retry()}>
            Try again
          </Button>
        </p>
      )}
      <PendingJobActions job={job} />
      <JobRecovery tab="scene" onSelect={setJobId} />
      {isFailed && (
        <p className="editor-error">
          Generation failed: {job?.error ?? 'unknown'}. Check your latest balance or contact an
          administrator if reconciliation is needed.
        </p>
      )}
      {isDone && job?.resultUrl && (
        <div className="editor-result-stack">
          <img src={job.resultUrl} alt="AI Scene result" className="editor-result-media" />
          <div className="editor-result-actions">
            {onApplyResult && (
              <Button size="sm" variant="secondary" onClick={() => onApplyResult(job.resultUrl!)}>
                <ImagePlus className="editor-action-icon" />
                Add to canvas
              </Button>
            )}
            <Button size="sm" variant="ghost" asChild>
              <a href={job.resultUrl} download target="_blank" rel="noreferrer">
                <Download className="editor-action-icon" />
                Download
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
