import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Video, Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import { PendingJobActions } from './pending-job-actions';
import { JobRecovery } from './job-recovery';
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
  const { job, isPending, isDone, isFailed, error, retry } = useAiJob(jobId);

  function readFile(file: File, setter: (v: string) => void) {
    if (!ACCEPTED.includes(file.type)) {
      toast({
        title: 'Unsupported format',
        description: 'Use PNG, JPG, or WEBP.',
        variant: 'danger',
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: 'File too large',
        description: 'Maximum file size: 10 MB.',
        variant: 'danger',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleGenerate() {
    if (submitting || isPending) return;
    if (!selectedModel || models.isError) {
      toast({ title: 'Choose a model first', variant: 'danger' });
      return;
    }
    if (!startFrame) {
      toast({
        title: 'Start frame required',
        description: 'Upload a start frame image.',
        variant: 'danger',
      });
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
      toast({ title: 'Video job created', description: 'Waiting for generation results…' });
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
        <h3 className="editor-panel-title">AI Motion</h3>
        <CreditBadge cost={selectedModel?.creditCost} />
      </div>

      <div className="editor-field">
        <label htmlFor="ai-motion-model" className="editor-field-label">
          Model
        </label>
        <select
          id="ai-motion-model"
          value={selectedModel?.id ?? ''}
          onChange={(e) => setModelId(e.target.value)}
          className="editor-model-select"
        >
          {models.isLoading && <option>Loading…</option>}
          {models.data?.length === 0 && <option value="">No video models available</option>}
          {models.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.modelName} ({m.creditCost} credit)
            </option>
          ))}
        </select>
      </div>

      {/* Start & End frame */}
      <div className="editor-paired-controls">
        <FramePicker
          label="Start frame"
          value={startFrame}
          onClick={() => startRef.current?.click()}
        />
        <FramePicker
          label="End frame (optional)"
          value={endFrame}
          onClick={() => endRef.current?.click()}
        />
        <input
          ref={startRef}
          type="file"
          accept={ACCEPTED.join(',')}
          className="editor-file-input"
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
          className="editor-file-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f, setEndFrame);
            e.target.value = '';
          }}
        />
      </div>

      {/* Trajectory kamera */}
      <div className="editor-control-stack">
        <span className="editor-field-label">Camera trajectory</span>
        <TrajectorySlider label="Horizontal" value={h} onChange={setH} />
        <TrajectorySlider label="Vertical" value={v} onChange={setV} />
        <TrajectorySlider label="Zoom" value={zoom} onChange={setZoom} />
      </div>

      <div className="editor-field">
        <div className="editor-panel-heading">
          <label className="editor-field-label">Duration</label>
          <span className="editor-readout">{durationSec}s</span>
        </div>
        <Slider
          value={[durationSec]}
          onValueChange={(val) => setDurationSec(val[0])}
          min={1}
          max={10}
          step={1}
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

      <div className="editor-field">
        <label htmlFor="ai-motion-prompt" className="editor-field-label">
          Prompt
        </label>
        <Input
          id="ai-motion-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video motion or atmosphere"
        />
      </div>

      <Button
        id="ai-motion-generate"
        onClick={handleGenerate}
        disabled={submitting || isPending || !selectedModel || models.isError}
      >
        {isPending ? (
          <Loader2 className="editor-loading-icon" />
        ) : (
          <Video className="editor-action-icon" />
        )}
        {isPending ? 'Generating...' : 'Generate Video'}
      </Button>

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
      <JobRecovery tab="motion" onSelect={setJobId} />
      {isFailed && (
        <p className="editor-error">
          Generation failed: {job?.error ?? 'unknown'}. Check your latest balance or contact an
          administrator if reconciliation is needed.
        </p>
      )}
      {isDone && job?.resultUrl && (
        <video src={job.resultUrl} controls className="editor-result-media" />
      )}
    </div>
  );
}

/** Kotak pratinjau / pemicu unggah frame. */
function FramePicker({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="ai-frame-picker">
      {value ? (
        <img src={value} alt={label} className="ai-frame-preview" />
      ) : (
        <>
          <UploadCloud className="ai-upload-icon" />
          <span className="ai-frame-label">{label}</span>
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
    <div className="ai-trajectory">
      <div className="ai-trajectory-heading">
        <span className="editor-muted">{label}</span>
        <span className="editor-numeric">{value.toFixed(1)}</span>
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
