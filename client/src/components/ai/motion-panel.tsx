import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Video, Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import { CreditBadge } from './credit-badge';
import { api, ApiRequestError } from '@/lib/api';
import { useAiJob } from '@/hooks/use-ai-job';
import type { AiAspect } from '@nesomn/shared';

/**
 * Panel Motion (video keyframe): start frame (wajib), end frame (opsional),
 * trajectory kamera (H/V/Zoom), durasi, aspect, prompt, lalu Generate.
 *
 * Catatan RK-1: bila model tidak mendukung end frame + camera control,
 * server/adapter menerapkan fallback. UI tetap menyediakan kontrak penuh.
 */

const ASPECTS: AiAspect[] = ['16:9', '9:16', '1:1', '4:3', '3:4'];
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export function MotionPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const startRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLInputElement | null>(null);

  const [modelId, setModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [aspect, setAspect] = useState<AiAspect>('16:9');
  const [startFrame, setStartFrame] = useState<string>('');
  const [endFrame, setEndFrame] = useState<string>('');
  const [h, setH] = useState(0);
  const [v, setV] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [durationSec, setDurationSec] = useState(4);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const models = useQuery({
    queryKey: ['ai-models', 'motion'],
    queryFn: () => api.ai.models('motion'),
  });
  const selectedModel = models.data?.find((m) => m.id === modelId) ?? models.data?.[0];
  const { job, isPending, isDone, isFailed } = useAiJob(jobId);

  function readFile(file: File, setter: (v: string) => void) {
    if (!ACCEPTED.includes(file.type)) {
      toast({ title: 'Format tidak didukung', description: 'PNG, JPG, atau WEBP.', variant: 'danger' });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: 'File terlalu besar', description: 'Maksimal 10MB.', variant: 'danger' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (!selectedModel) {
      toast({ title: 'Pilih model dulu', variant: 'danger' });
      return;
    }
    if (!startFrame) {
      toast({ title: 'Start frame wajib', description: 'Unggah gambar frame awal.', variant: 'danger' });
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
        tab: 'motion',
        input: {
          startFrame,
          endFrame: endFrame || undefined,
          trajectory: { h, v, zoom },
          durationSec,
          aspect,
          prompt,
        },
      });
      setJobId(created.id);
      qc.invalidateQueries({ queryKey: ['ai-credit'] });
      toast({ title: 'Job video dibuat', description: 'Menunggu hasil generate...' });
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
        <h3 className="text-sm font-semibold">AI Motion</h3>
        <CreditBadge cost={selectedModel?.creditCost} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Model</label>
        <select
          id="ai-motion-model"
          value={selectedModel?.id ?? ''}
          onChange={(e) => setModelId(e.target.value)}
          className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
        >
          {models.isLoading && <option>Memuat...</option>}
          {models.data?.length === 0 && <option value="">Belum ada model video</option>}
          {models.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.modelName} ({m.creditCost} credit)
            </option>
          ))}
        </select>
      </div>

      {/* Start & End frame */}
      <div className="grid grid-cols-2 gap-2">
        <FramePicker
          label="Start frame"
          value={startFrame}
          onClick={() => startRef.current?.click()}
        />
        <FramePicker
          label="End frame (opsional)"
          value={endFrame}
          onClick={() => endRef.current?.click()}
        />
        <input
          ref={startRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f, setStartFrame);
            e.target.value = '';
          }}
        />
        <input
          ref={endRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f, setEndFrame);
            e.target.value = '';
          }}
        />
      </div>

      {/* Trajectory kamera */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium text-muted-foreground">Camera trajectory</span>
        <TrajectorySlider label="Horizontal" value={h} onChange={setH} />
        <TrajectorySlider label="Vertical" value={v} onChange={setV} />
        <TrajectorySlider label="Zoom" value={zoom} onChange={setZoom} />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Durasi</label>
          <span className="font-mono text-xs">{durationSec}s</span>
        </div>
        <Slider value={[durationSec]} onValueChange={(val) => setDurationSec(val[0])} min={1} max={10} step={1} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Aspect ratio</label>
        <div className="flex flex-wrap gap-2">
          {ASPECTS.map((a) => (
            <Button key={a} size="sm" variant={aspect === a ? 'primary' : 'ghost'} onClick={() => setAspect(a)}>
              {a}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Prompt</label>
        <Input
          id="ai-motion-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Deskripsikan gerakan / suasana video"
        />
      </div>

      <Button id="ai-motion-generate" onClick={handleGenerate} disabled={submitting || isPending || !selectedModel}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
        {isPending ? 'Generating...' : 'Generate Video'}
      </Button>

      {isFailed && (
        <p className="text-sm text-danger">
          Generate gagal: {job?.error ?? 'tidak diketahui'}. Credit dikembalikan.
        </p>
      )}
      {isDone && job?.resultUrl && (
        <video src={job.resultUrl} controls className="w-full rounded-lg border border-border" />
      )}
    </div>
  );
}

/** Kotak pratinjau / pemicu unggah frame. */
function FramePicker({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-border bg-surface-2 text-xs text-muted-foreground transition-colors hover:border-accent"
    >
      {value ? (
        <img src={value} alt={label} className="size-full object-cover" />
      ) : (
        <>
          <UploadCloud className="size-5" />
          <span className="px-1 text-center">{label}</span>
        </>
      )}
    </button>
  );
}

/** Slider trajectory rentang -1..1 dengan label dan nilai. */
function TrajectorySlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toFixed(1)}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(val) => onChange(val[0])}
        min={-1}
        max={1}
        step={0.1}
      />
    </div>
  );
}
