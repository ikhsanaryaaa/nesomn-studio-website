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
      <Seo title="Demo / Sample 3D" />
      <header className="page-heading">
        <h1>3D playground.</h1>
        <p>
          Demo / Sample — four original models for testing previews. These are not marketplace
          products or client work.
        </p>
      </header>
      <div className="demo-model-picker" aria-label="Choose a sample model">
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
      <h2 className="demo-model-title">{model.title} · Demo / Sample</h2>
      <Suspense fallback={<p role="status">Loading viewer…</p>}>
        <ModelViewer url={model.url} poster={model.poster} title={model.title} />
      </Suspense>
      <p className="workspace-footer-note">
        GLB2.0 embedded · {Math.ceil(model.bytes / 1024)}KB · generated locally; no credentials or
        provider required.
      </p>
    </div>
  );
}
