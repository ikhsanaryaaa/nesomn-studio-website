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
      if (!asset.modelUrl) throw Error('Model3D belum tersedia untuk aset ini.');
      setUrl(asset.modelUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview belum dapat dimuat.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="mt-6">
      <h2 className="mb-4 text-lg font-semibold">Preview3D read-only</h2>
      {url ? (
        <Suspense fallback={<p role="status">Memuat viewer…</p>}>
          <ModelViewer url={url} title={title} poster={poster} />
        </Suspense>
      ) : (
        <Button variant="secondary" disabled={pending} onClick={() => void load()}>
          {pending ? 'Memeriksa akses…' : 'Muat preview3D'}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-danger">
          {error}
        </p>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Memerlukan akses model dari server. Tidak membuat atau mengubah project.
      </p>
    </section>
  );
}
