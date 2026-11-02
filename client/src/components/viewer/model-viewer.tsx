import { scenePointerEvents } from '@/lib/scene-pointer-events';
import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { useModel } from './use-model';
import { FramedControls, StudioEnvironment } from './studio-stage';
import { RenderBoundary } from './render-boundary';
export function ModelViewer({
  url,
  poster,
  title = '3D model',
}: {
  url: string;
  poster?: string;
  title?: string;
}) {
  const [retry, setRetry] = useState(0),
    [reset, setReset] = useState(0),
    [zoom, setZoom] = useState(0),
    [rotate, setRotate] = useState(false),
    [dark, setDark] = useState(false),
    [unsupported, setUnsupported] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionPreference();
  const model = useModel(unsupported ? null : url, retry);
  useEffect(() => {
    const canvas = container.current?.querySelector('canvas');
    if (!canvas) return;
    const lost = (event: Event) => {
      event.preventDefault();
      setUnsupported(true);
    };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [model.scene]);
  useEffect(() => {
    const test = document.createElement('canvas');
    const context = test.getContext('webgl2') ?? test.getContext('webgl');
    if (!context) setUnsupported(true);
    else context.getExtension('WEBGL_lose_context')?.loseContext();
  }, []);
  useEffect(() => {
    setRotate(false);
    setReset((v) => v + 1);
    setZoom(0);
  }, [url]);
  const error =
    model.error ??
    (unsupported
      ? 'This browser or device does not support WebGL. The poster is still available.'
      : null);
  const fallback = (
    <div className="viewer-fallback" role="alert">
      <p>The 3D renderer could not start.</p>
      <Button onClick={() => setRetry((v) => v + 1)}>Try again</Button>
    </div>
  );
  return (
    <div ref={container} className="model-viewer" aria-label={title + ' read-only preview'}>
      <div
        className="viewer-stage"
        data-state={error ? 'error' : model.scene ? 'ready' : 'loading'}
      >
        {(!model.scene || error) && poster && (
          <img className="viewer-poster" src={poster} alt={'Poster ' + title} />
        )}
        {error ? (
          <div className="viewer-fallback" role="alert">
            <p>{error}</p>
            {!unsupported && <Button onClick={() => setRetry((v) => v + 1)}>Try again</Button>}
          </div>
        ) : model.scene ? (
          <RenderBoundary key={url + retry} fallback={fallback}>
            <Canvas
              events={scenePointerEvents}
              shadows
              dpr={[1, 1.5]}
              frameloop="demand"
              gl={{
                antialias: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                outputColorSpace: THREE.SRGBColorSpace,
              }}
              camera={{ fov: 45 }}
              fallback={fallback}
            >
              <color attach="background" args={[dark ? '#262623' : '#eeede8']} />
              <StudioEnvironment />
              <primitive object={model.scene} dispose={null} />
              <FramedControls
                object={model.scene}
                reset={reset}
                zoom={zoom}
                rotate={rotate}
                reduced={!!reduced}
              />
            </Canvas>
          </RenderBoundary>
        ) : (
          <div className="viewer-fallback" role="status">
            <p>{model.progress ? 'Loading model ' + model.progress + '%' : 'Loading 3D model…'}</p>
          </div>
        )}
      </div>
      <div className="viewer-toolbar" aria-label="Preview controls">
        <Button
          variant="secondary"
          disabled={!model.scene || !!error}
          onClick={() => setReset((v) => v + 1)}
        >
          Reset View
        </Button>
        <Button
          variant="secondary"
          aria-label="Zoom In"
          disabled={!model.scene || !!error}
          onClick={() => setZoom((v) => v + 1)}
        >
          Zoom +
        </Button>
        <Button
          variant="secondary"
          aria-label="Zoom Out"
          disabled={!model.scene || !!error}
          onClick={() => setZoom((v) => v - 1)}
        >
          Zoom −
        </Button>
        <Button
          variant="secondary"
          aria-pressed={rotate && !reduced}
          disabled={!!reduced || !model.scene}
          onClick={() => setRotate((v) => !v)}
        >
          Auto-Rotate {rotate && !reduced ? 'On' : 'Off'}
        </Button>
        <Button variant="secondary" aria-pressed={dark} onClick={() => setDark((v) => !v)}>
          Background: {dark ? 'dark' : 'light'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
            else void container.current?.requestFullscreen?.().catch(() => {});
          }}
        >
          Fullscreen
        </Button>
      </div>
      <p className="viewer-gesture-hint">
        Drag to orbit · pinch or use the mouse wheel to zoom. The preview does not change your
        project.{reduced ? ' Reduced motion is enabled.' : ''}
      </p>
    </div>
  );
}
