import { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';
import models from '../../public/demo/models/manifest.json';
const ModelViewer = lazy(() =>
  import('@/components/viewer/model-viewer').then((m) => ({ default: m.ModelViewer })),
);
export default function Demo3DPage() {
  const [index, setIndex] = useState(0);
  const model = models[index];
  return (
    <div className="page-wrap">
      <Seo title="Demo / Sample3D" />
      <header className="page-heading">
        <h1>3D playground.</h1>
        <p>
          Demo / Sample — empat geometry orisinal untuk menguji preview. Bukan produk marketplace
          atau karya klien.
        </p>
      </header>
      <div className="demo-model-picker" aria-label="Pilih sample model">
        {models.map((m, i) => (
          <Button
            variant={index === i ? 'primary' : 'secondary'}
            aria-pressed={index === i}
            key={m.id}
            onClick={() => setIndex(i)}
          >
            {m.title}
          </Button>
        ))}
      </div>
      <h2 className="my-4 text-xl font-semibold">{model.title} · Demo / Sample</h2>
      <Suspense fallback={<p role="status">Memuat viewer…</p>}>
        <ModelViewer url={model.url} poster={model.poster} title={model.title} />
      </Suspense>
      <p className="mt-6 text-sm text-muted-foreground">
        GLB2.0 embedded · {Math.ceil(model.bytes / 1024)}KB · generator lokal, tidak memerlukan
        credential/provider.
      </p>
    </div>
  );
}
