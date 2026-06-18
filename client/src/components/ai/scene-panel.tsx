import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Loader2, Download, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
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
  const { job, isPending, isDone, isFailed } = useAiJob(jobId);

  async function handleGenerate() {
    if (!selectedModel) {
      toast({ title: 'Pilih model dulu', variant: 'danger' });
      return;
    }
    if (!prompt.trim()) {
      toast({ title: 'Prompt masih kosong', variant: 'danger' });
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
      toast({ title: 'Job dibuat', description: 'Menunggu hasil generate...' });
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Gagal membuat job.';
      toast({ title: 'Tidak dapat generate', description: msg, variant: 'danger' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Scene</h3>
        <CreditBadge cost={selectedModel?.creditCost} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Model</label>
        <select
          id="ai-scene-model"
          value={selectedModel?.id ?? ''}
          onChange={(e) => setModelId(e.target.value)}
          className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
        >
          {models.isLoading && <option>Memuat...</option>}
          {models.data?.length === 0 && <option value="">Belum ada model</option>}
          {models.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.modelName} ({m.creditCost} credit)
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Prompt</label>
        <Input
          id="ai-scene-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Deskripsikan hasil yang diinginkan"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Aspect ratio</label>
        <div className="flex flex-wrap gap-2">
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
        disabled={submitting || isPending || !selectedModel}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {isPending ? 'Generating...' : 'Generate'}
      </Button>

      {/* Hasil */}
      {isFailed && (
        <p className="text-sm text-danger">
          Generate gagal: {job?.error ?? 'tidak diketahui'}. Credit dikembalikan.
        </p>
      )}
      {isDone && job?.resultUrl && (
        <div className="flex flex-col gap-2">
          <img
            src={job.resultUrl}
            alt="Hasil AI Scene"
            className="w-full rounded-lg border border-border"
          />
          <div className="flex gap-2">
            {onApplyResult && (
              <Button size="sm" variant="secondary" onClick={() => onApplyResult(job.resultUrl!)}>
                <ImagePlus className="size-4" />
                Tarik ke canvas
              </Button>
            )}
            <Button size="sm" variant="ghost" asChild>
              <a href={job.resultUrl} download target="_blank" rel="noreferrer">
                <Download className="size-4" />
                Unduh
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
