import { editorEpoch } from '@/lib/editor-session';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useParams } from 'react-router';
import type Konva from 'konva';
import { Plus, Type } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Seo } from '@/components/seo';
import { useToast } from '@/components/ui/use-toast';
import { SceneCanvas } from '@/components/editor/scene-canvas';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { AddDesignDialog } from '@/components/editor/add-design-dialog';
import { ColorPanel } from '@/components/editor/color-panel';
import { ScenePanel } from '@/components/ai/scene-panel';
import { MotionPanel } from '@/components/ai/motion-panel';
import { useSceneEditor } from '@/stores/scene-editor-store';
import { fitScene } from '@/lib/scene-viewport';
import { SceneInspector } from '@/components/editor/scene-inspector';
import { exportStage, type ExportFormat } from '@/lib/export-image';
import { api, ApiRequestError } from '@/lib/api';
import type { SceneState } from '@nesomn/shared';

/**
 * Scene Editor 2D: canvas Konva + panel Design/Colour, simpan/muat project.
 * Buka project tersimpan via query `?project=<id>`. Tanpa id mulai kosong.
 */
export default function SceneEditorPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get('project');
  const { slug } = useParams();

  const viewportRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const aiImages = useRef(new Set<HTMLImageElement>());
  const activeDocument = useRef('');
  activeDocument.current = (projectIdParam ?? '') + ':' + (slug ?? '');
  const createdProject = useRef<string | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [tab, setTab] = useState<'design' | 'colour' | 'ai-scene' | 'ai-motion'>('design');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scale, setScale] = useState(1);

  const title = useSceneEditor((s) => s.title);
  const projectId = useSceneEditor((s) => s.projectId);
  const setTitle = useSceneEditor((s) => s.setTitle);
  const addText = useSceneEditor((s) => s.addText);
  const addImage = useSceneEditor((s) => s.addImage);
  const loadState = useSceneEditor((s) => s.loadState);
  const toState = useSceneEditor((s) => s.toState);
  const markSaved = useSceneEditor((s) => s.markSaved);
  const reset = useSceneEditor((s) => s.reset);
  const canvas = useSceneEditor((s) => s.canvas);

  useEffect(() => {
    activeDocument.current = (projectIdParam ?? '') + ':' + (slug ?? '');
    return () => {
      activeDocument.current = '\0';
    };
  }, [projectIdParam, slug]);

  // Muat project dari query, atau reset scene baru.
  useEffect(() => {
    let active = true;
    setLoadError(null);
    if (projectIdParam && projectIdParam === createdProject.current) {
      createdProject.current = null;
      setLoading(false);
      return;
    }
    reset();
    setLoading(Boolean(projectIdParam));
    if (projectIdParam) {
      api.projects
        .get(projectIdParam)
        .then((p) => {
          if (!active) return;
          if (p.kind !== 'scene2d') throw new Error('This project is not a 2D scene.');
          loadState(p.state as SceneState, p.id, p.title);
        })
        .catch((err) => {
          if (!active) return;
          const msg = err instanceof Error ? err.message : 'Unable to load the project.';
          setLoadError(msg);
          toast({ title: 'Unable to open project', description: msg, variant: 'danger' });
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      reset();
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdParam]);

  // Muat base mockup dari katalog bila dibuka via /editor/scene/:slug.
  useEffect(() => {
    if (!slug || projectIdParam) return;
    let active = true;
    const epoch = editorEpoch();
    let image: HTMLImageElement | undefined;
    api
      .editorAsset(slug)
      .then((asset) => {
        if (!active || !asset.modelUrl) return;
        const img = new window.Image();
        image = img;
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (active && epoch === editorEpoch()) {
            addImage(
              '/api/catalog/editor-image/' + encodeURIComponent(asset.slug),
              img.naturalWidth,
              img.naturalHeight,
            );
            setTitle(asset.title);
          }
        };
        img.onerror = () => {
          if (active)
            toast({
              title: 'Unable to load image',
              description: 'Try reopening the asset to refresh its URL.',
              variant: 'danger',
            });
        };
        img.src = asset.modelUrl;
      })
      .catch((err) => {
        if (!active || epoch !== editorEpoch()) return;
        const msg = err instanceof ApiRequestError ? err.message : 'Unable to load the mockup.';
        toast({ title: 'Unable to load mockup', description: msg, variant: 'danger' });
      });
    return () => {
      active = false;
      if (image) {
        image.onload = null;
        image.onerror = null;
        image.src = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, projectIdParam]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(
        fitScene(
          canvas.width,
          canvas.height,
          Math.max(1, entry.contentRect.width - 32),
          Math.max(1, entry.contentRect.height - 32),
        ),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [canvas.width, canvas.height]);

  function handleExport(format: ExportFormat) {
    if (!stageRef.current || loading || loadError) return;
    try {
      if (stageRef.current.getAttr('nesomnImagesReady') !== true)
        throw Error('The image is not ready');
      exportStage(stageRef.current, format, title || 'nesomn-scene', canvas);
      toast({
        title: 'Export started',
        description: `Downloading ${format.toUpperCase()} (up to 1080p).`,
      });
    } catch {
      toast({
        title: 'Export failed',
        description:
          "Check the image and the source's CORS permissions. You can still edit the canvas.",
        variant: 'danger',
      });
    }
  }

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (loading || loadError || event.altKey || document.querySelector('[role="dialog"]')) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const store = useSceneEditor.getState();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        store.deleteSelected();
      } else if (event.key === 'Escape') store.select(null);
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [loading, loadError]);

  useEffect(() => {
    const images = aiImages.current;
    return () => {
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
        image.src = '';
      }
      images.clear();
    };
  }, [projectIdParam, slug]);

  // Tarik hasil image AI ke canvas: muat untuk ambil dimensi natural dulu.
  function applyAiImage(url: string) {
    const epoch = editorEpoch();
    const documentKey = activeDocument.current;
    const img = new window.Image();
    aiImages.current.add(img);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      aiImages.current.delete(img);
      if (epoch !== editorEpoch() || documentKey !== activeDocument.current) return;
      addImage(url, img.naturalWidth, img.naturalHeight);
      setTab('design');
      toast({ title: 'Result added', description: 'The AI image has been added to the canvas.' });
    };
    img.onerror = () => {
      aiImages.current.delete(img);
      toast({
        title: 'Unable to load result',
        description: 'The image source is invalid.',
        variant: 'danger',
      });
    };
    img.src = url;
  }

  async function handleSave() {
    if (saving || loading || loadError) return;
    const documentKey = activeDocument.current;
    const epoch = editorEpoch();
    setSaving(true);
    try {
      const state = toState();
      if (projectId) {
        const updated = await api.projects.update(projectId, { title, state });
        if (epoch !== editorEpoch() || activeDocument.current !== documentKey) return;
        markSaved(updated.id, title, state);
        toast({ title: 'Saved', description: 'Your project changes have been saved.' });
      } else {
        const created = await api.projects.create({ title, kind: 'scene2d', state });
        if (epoch !== editorEpoch() || activeDocument.current !== documentKey) return;
        markSaved(created.id, title, state);
        createdProject.current = created.id;
        setSearchParams({ project: created.id }, { replace: true });
        toast({ title: 'Project created', description: 'Your new scene has been saved.' });
      }
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Unable to save.';
      const hint =
        err instanceof ApiRequestError && err.status === 401 ? ' Log in to save your work.' : '';
      toast({ title: 'Unable to save', description: msg + hint, variant: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="scene-page">
      <Seo
        title="Scene Editor"
        description="A browser-based 2D mockup editor from Nesomn Studio."
      />
      <Topbar
        title="Scene Editor"
        right={<span className="workspace-caption">2D Workspace</span>}
      />
      <div className="scene-actions">
        <div className="scene-document-tabs">
          {
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as 'design' | 'colour' | 'ai-scene' | 'ai-motion')}
              className="scene-reset"
            >
              <TabsList>
                <TabsTrigger value="design">Design</TabsTrigger>
                <TabsTrigger value="colour">Colour</TabsTrigger>
                <TabsTrigger value="ai-scene">AI Scene</TabsTrigger>
                <TabsTrigger value="ai-motion">AI Motion</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        </div>
        <EditorToolbar
          onExport={handleExport}
          onSave={handleSave}
          saving={saving || loading || Boolean(loadError)}
        />
      </div>

      <div role="region" aria-label="2D scene workspace" className="scene-workspace">
        {/* Area canvas */}
        <div ref={viewportRef} className="scene-canvas-region">
          <div className="scene-canvas-frame" style={{ lineHeight: 0 }}>
            {loading ? (
              <p role="status">Loading project…</p>
            ) : loadError ? (
              <div role="alert" className="scene-render-error">
                {loadError}
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Try again
                </Button>
              </div>
            ) : (
              <SceneCanvas ref={stageRef} scale={scale} />
            )}
          </div>
        </div>

        {/* Panel kanan */}
        <aside className="scene-properties">
          <div className="scene-project-settings">
            <label htmlFor="project-title" className="scene-project-label">
              Project name
            </label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} id="project-title" />
          </div>

          {tab === 'design' && (
            <div className="scene-add-actions">
              <Button id="add-design" variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus className="workspace-action-icon" />
                Add Design
              </Button>
              <Button id="add-text" variant="ghost" onClick={() => addText('New text')}>
                <Type className="workspace-action-icon" />
                Add Text
              </Button>
              <SceneInspector />
            </div>
          )}
          {tab === 'colour' && <ColorPanel />}
          <div hidden={tab !== 'ai-scene'}>
            <ScenePanel onApplyResult={applyAiImage} />
          </div>
          <div hidden={tab !== 'ai-motion'}>
            <MotionPanel />
          </div>
        </aside>
      </div>

      <AddDesignDialog open={addOpen} onOpenChange={setAddOpen} />
    </section>
  );
}
