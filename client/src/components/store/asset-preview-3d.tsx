import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
const ModelViewer = lazy(() =>
  import('@/components/viewer/model-viewer').then((m) => ({ default: m.ModelViewer })),
);
export function AssetPreview3D({
  slug,
  title,
  poster,
}: {
  slug: string;
  title: string;
  poster?: string;
}) {
  const [url, setUrl] = useState<string | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  async function load() {
    setPending(true);
    setError('');
    try {
      const asset = await api.editorAsset(slug);
      if (!asset.modelUrl) throw Error('A 3D model is not available for this asset yet.');
      setUrl(asset.modelUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the preview.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="asset-model-preview">
      <h2 className="asset-model-preview-title">Read-only 3D preview</h2>
      {url ? (
        <Suspense fallback={<p role="status">Loading viewer…</p>}>
          <ModelViewer url={url} title={title} poster={poster} />
        </Suspense>
      ) : (
        <Button variant="secondary" disabled={pending} onClick={() => void load()}>
          {pending ? 'Checking access…' : 'Load 3D preview'}
        </Button>
      )}
      {error && (
        <p role="alert" className="asset-model-preview-error">
          {error}
        </p>
      )}
      <p className="asset-model-preview-hint">
        Requires model access from the server. This preview does not create or change projects.
      </p>
    </section>
  );
}
