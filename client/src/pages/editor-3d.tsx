import { editorEpoch } from '@/lib/editor-session';
import { RenderBoundary } from '@/components/viewer/render-boundary';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useParams } from 'react-router';
import type { WebGLRenderer } from 'three';
import type { Scene3DState } from '@nesomn/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Seo } from '@/components/seo';
import { useToast } from '@/components/ui/use-toast';
import { Scene3DViewport } from '@/components/editor3d/scene-3d-viewport';
import { ControlsPanel3D } from '@/components/editor3d/controls-panel-3d';
import { AddDesign3DDialog } from '@/components/editor3d/add-design-3d-dialog';
import { useScene3DEditor } from '@/stores/scene-3d-store';
import { exportRendererImage, type ExportImageFormat } from '@/lib/export-3d';
import { recordTurntable } from '@/lib/record-3d-video';
import { api } from '@/lib/api';
import models from '../../public/demo/models/manifest.json';
export default function Editor3DPage() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams(),
    { slug } = useParams(),
    projectParam = params.get('project');
  const createdProject = useRef<string | null>(null);
  const activeDocument = useRef(0);
  const gl = useRef<WebGLRenderer | null>(null),
    abort = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0),
    [saving, setSaving] = useState(false),
    [recording, setRecording] = useState(false),
    [rotate, setRotate] = useState(false),
    [tab, setTab] = useState<'design' | 'colour'>('design'),
    [addOpen, setAddOpen] = useState(false),
    [meshes, setMeshes] = useState<{ path: string; name: string }[]>([]);
  const state = useScene3DEditor();
  const bindGl = useCallback((value: WebGLRenderer | null) => {
      gl.current = value;
    }, []),
    bindMeshes = useCallback((value: { path: string; name: string }[]) => setMeshes(value), []);
  useEffect(() => {
    if (projectParam && createdProject.current === projectParam) {
      createdProject.current = null;
      return;
    }
    const generation = ++activeDocument.current;
    let active = true;
    setLoading(true);
    setError('');
    gl.current = null;
    useScene3DEditor.getState().reset();
    void (async () => {
      try {
        let key = 'mug';
        if (projectParam) {
          const project = await api.projects.get(projectParam);
          if (!active) return;
          if (project.kind !== 'scene3d') throw Error('This project is not a 3D scene.');
          const scene = project.state as Scene3DState;
          useScene3DEditor.getState().loadState(scene, project.id, project.title);
          key = scene.modelKey ?? 'mug';
        } else if (slug) {
          key = slug;
          useScene3DEditor.getState().setModelKey(key);
        }
        if (key.startsWith('sample:')) {
          const model = models.find((m) => 'sample:' + m.id === key);
          if (!model) throw Error('The sample model is unavailable.');
          if (active) useScene3DEditor.getState().setModelUrl(model.url);
        } else if (key !== 'mug' || useScene3DEditor.getState().modelSource === 'catalog') {
          const asset = await api.editorAsset(key);
          if (!active) return;
          if (!['mockup3d', 'asset3d'].includes(asset.type) || !asset.modelUrl)
            throw Error('The 3D model is unavailable or access was denied.');
          useScene3DEditor.getState().setModelUrl(asset.modelUrl);
          if (!projectParam) useScene3DEditor.getState().setTitle(asset.title);
        }
        if (active) setLoading(false);
      } catch (err) {
        if (active) {
          setLoading(false);
          setError(err instanceof Error ? err.message : 'Unable to load the model.');
        }
      }
    })();
    return () => {
      active = false;
      activeDocument.current = generation + 1;
      abort.current?.abort();
    };
  }, [projectParam, slug, attempt]);
  useEffect(() => {
    const document = activeDocument;
    return () => {
      document.current++;
      abort.current?.abort();
    };
  }, []);
  function image(format: ExportImageFormat) {
    if (!gl.current) return;
    try {
      exportRendererImage(gl.current, format, state.title || 'nesomn-3d');
      toast({ title: 'Export started' });
    } catch {
      toast({
        title: 'Export failed',
        description: 'Check CORS access, textures, and renderer support.',
        variant: 'danger',
      });
    }
  }
  async function video() {
    if (!gl.current || recording) return;
    const controller = new AbortController();
    abort.current = controller;
    setRecording(true);
    setRotate(true);
    try {
      await recordTurntable(gl.current.domElement, () => {}, {
        durationMs: 4000,
        fps: 30,
        fileName: state.title || 'nesomn-3d',
        signal: controller.signal,
      });
      toast({ title: 'Video saved' });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError'))
        toast({ title: 'Recording failed', variant: 'danger' });
    } finally {
      setRecording(false);
      setRotate(false);
    }
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    const document = activeDocument.current;
    const epoch = editorEpoch();
    try {
      const current = useScene3DEditor.getState();
      const snapshot = current.toState();
      const result = current.projectId
        ? await api.projects.update(current.projectId, {
            title: current.title,
            state: snapshot,
          })
        : await api.projects.create({
            title: current.title,
            kind: 'scene3d',
            state: snapshot,
          });
      if (epoch !== editorEpoch() || document !== activeDocument.current) return;
      if (!current.markSaved(result.id, current.title, snapshot, current.documentVersion)) return;
      if (!projectParam) {
        createdProject.current = result.id;
        setParams({ project: result.id }, { replace: true });
      }
      toast({
        title: 'Project snapshot saved',
        description: useScene3DEditor.getState().dirty
          ? 'Your latest changes have not been saved. Click Save again.'
          : undefined,
      });
    } catch (err) {
      if (epoch !== editorEpoch() || document !== activeDocument.current) return;
      toast({
        title: 'Unable to save',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'danger',
      });
    } finally {
      setSaving(false);
    }
  }
  const disabled = loading || !!error || recording;
  return (
    <>
      <Seo title="3D Editor" />
      <header className="editor3d-toolbar">
        <h1>3D Editor</h1>
        <div className="editor3d-primary-actions">
          <Button
            aria-pressed={tab === 'design'}
            variant={tab === 'design' ? 'primary' : 'ghost'}
            onClick={() => setTab('design')}
          >
            Design
          </Button>
          <Button
            aria-pressed={tab === 'colour'}
            variant={tab === 'colour' ? 'primary' : 'ghost'}
            onClick={() => setTab('colour')}
          >
            Colour
          </Button>
        </div>
        <div className="editor3d-file-actions">
          <Button variant="secondary" disabled={disabled} onClick={() => image('png')}>
            PNG
          </Button>
          <Button variant="secondary" disabled={disabled} onClick={() => image('jpeg')}>
            JPEG
          </Button>
          <Button variant="secondary" disabled={disabled} onClick={() => void video()}>
            {recording ? 'Recording…' : 'Render Video'}
          </Button>
          <Button disabled={disabled || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>
      <div className="editor3d-workspace">
        <div className="editor3d-canvas">
          {loading ? (
            <p role="status" className="editor3d-feedback">
              Loading 3D scene…
            </p>
          ) : error ? (
            <div role="alert" className="editor3d-feedback">
              <p>{error}</p>
              <Button onClick={() => setAttempt((v) => v + 1)}>Try again</Button>
            </div>
          ) : (
            <RenderBoundary
              key={attempt}
              fallback={
                <div role="alert" className="editor3d-feedback">
                  <p>The 3D renderer is unavailable. Check WebGL support and the model.</p>
                  <Button onClick={() => setAttempt((v) => v + 1)}>Try again</Button>
                </div>
              }
            >
              <Scene3DViewport onGlReady={bindGl} autoRotate={rotate} onMeshes={bindMeshes} />
            </RenderBoundary>
          )}{' '}
          {!slug && !projectParam && (
            <p className="sample-scene-label">
              Demo / Sample — built-in cylinder, not a catalogue product.
            </p>
          )}
        </div>
        <aside className="editor3d-inspector">
          <div className="editor3d-project-settings">
            <p role="status" className="editor3d-save-status">
              {state.dirty ? 'You have unsaved changes' : 'No unsaved changes'}
            </p>
            <Input
              label="Project name"
              id="project-title-3d"
              value={state.title}
              onChange={(e) => state.setTitle(e.target.value)}
            />
          </div>
          <ControlsPanel3D tab={tab} meshes={meshes} onAddDesign={() => setAddOpen(true)} />
        </aside>
      </div>
      <AddDesign3DDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
