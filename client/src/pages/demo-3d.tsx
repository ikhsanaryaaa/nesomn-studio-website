import { useState, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/seo';
import studioKit from '../../public/demo/models/studio-kit.json';
import baseModels from '../../public/demo/models/manifest.json';
const models = [...baseModels, studioKit];
const ModelViewer = lazy(() =>
  import('@/components/viewer/model-viewer').then((m) => ({ default: m.ModelViewer })),
);
export default function Demo3DPage() {
  const [index, setIndex] = useState(() => {
    const id = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get(
      'model',
    );
    return Math.max(
      0,
      models.findIndex((model) => model.id === id),
    );
  });
  const model = models[index];
  return (
    <div className="page-wrap">
      <Seo title="Demo / Sample 3D" />
      <header className="page-heading">
        <h1>3D playground.</h1>
        <p>
          Demo / Sample — original models for testing previews. These are not marketplace products
          or client work.
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
