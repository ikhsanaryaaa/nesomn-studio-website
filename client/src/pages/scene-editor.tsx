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
          if (p.kind !== 'scene2d') throw new Error('Project ini bukan Scene 2D.');
          loadState(p.state as SceneState, p.id, p.title);
        })
        .catch((err) => {
          if (!active) return;
          const msg = err instanceof Error ? err.message : 'Gagal memuat project.';
          setLoadError(msg);
          toast({ title: 'Tidak dapat membuka project', description: msg, variant: 'danger' });
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
              title: 'Gambar gagal dimuat',
              description: 'Coba buka ulang aset untuk memperbarui URL.',
              variant: 'danger',
            });
        };
        img.src = asset.modelUrl;
      })
      .catch((err) => {
        if (!active || epoch !== editorEpoch()) return;
        const msg = err instanceof ApiRequestError ? err.message : 'Gagal memuat mockup.';
        toast({ title: 'Tidak dapat memuat mockup', description: msg, variant: 'danger' });
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
      if (stageRef.current.getAttr('nesomnImagesReady') !== true) throw Error('Gambar belum siap');
      exportStage(stageRef.current, format, title || 'nesomn-scene', canvas);
      toast({
        title: 'Export dimulai',
        description: `Mengunduh ${format.toUpperCase()} (maks 1080p).`,
      });
    } catch {
      toast({
        title: 'Export gagal',
        description: 'Periksa gambar dan izin CORS sumber. Canvas tetap dapat diedit.',
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
      toast({ title: 'Hasil ditambahkan', description: 'Image AI masuk ke canvas.' });
    };
    img.onerror = () => {
      aiImages.current.delete(img);
      toast({
        title: 'Gagal memuat hasil',
        description: 'Sumber gambar tidak valid.',
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
        toast({ title: 'Tersimpan', description: 'Perubahan project disimpan.' });
      } else {
        const created = await api.projects.create({ title, kind: 'scene2d', state });
        if (epoch !== editorEpoch() || activeDocument.current !== documentKey) return;
        markSaved(created.id, title, state);
        createdProject.current = created.id;
        setSearchParams({ project: created.id }, { replace: true });
        toast({ title: 'Project dibuat', description: 'Scene baru tersimpan.' });
      }
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Gagal menyimpan.';
      const hint =
        err instanceof ApiRequestError && err.status === 401 ? ' Login dulu untuk menyimpan.' : '';
      toast({ title: 'Gagal menyimpan', description: msg + hint, variant: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <Seo title="Scene Editor" description="Editor mockup 2D berbasis browser di Nesomn Studio." />
      <Topbar
        title="Scene Editor"
        right={<span className="text-xs text-muted-foreground">2D Workspace</span>}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface p-2">
        <div className="min-w-0 max-w-full overflow-x-auto">
          {
            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as 'design' | 'colour' | 'ai-scene' | 'ai-motion')}
              className="ml-4"
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

      <div
        role="region"
        aria-label="Area kerja Scene 2D"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
      >
        {/* Area canvas */}
        <div
          ref={viewportRef}
          className="flex min-h-[320px] min-w-0 flex-1 items-center justify-center overflow-hidden bg-surface-2 p-4"
        >
          <div className="shadow-2xl ring-1 ring-border" style={{ lineHeight: 0 }}>
            {loading ? (
              <p role="status">Memuat project...</p>
            ) : loadError ? (
              <div role="alert" className="max-w-xs p-4 text-sm leading-normal">
                {loadError}
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Coba lagi
                </Button>
              </div>
            ) : (
              <SceneCanvas ref={stageRef} scale={scale} />
            )}
          </div>
        </div>

        {/* Panel kanan */}
        <aside className="flex max-h-[55dvh] w-full shrink-0 flex-col overflow-y-auto border-t border-border bg-surface lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
          <div className="border-b border-border p-4">
            <label
              htmlFor="project-title"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Nama project
            </label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} id="project-title" />
          </div>

          {tab === 'design' && (
            <div className="flex flex-col gap-2 p-4">
              <Button id="add-design" variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Add Design
              </Button>
              <Button id="add-text" variant="ghost" onClick={() => addText('Teks baru')}>
                <Type className="size-4" />
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
