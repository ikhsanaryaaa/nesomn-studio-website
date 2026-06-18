import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
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
import { useSceneEditor } from '@/stores/scene-editor-store';
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

  const stageRef = useRef<Konva.Stage | null>(null);
  const [tab, setTab] = useState<'design' | 'colour'>('design');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scale, setScale] = useState(1);

  const title = useSceneEditor((s) => s.title);
  const projectId = useSceneEditor((s) => s.projectId);
  const setTitle = useSceneEditor((s) => s.setTitle);
  const addText = useSceneEditor((s) => s.addText);
  const loadState = useSceneEditor((s) => s.loadState);
  const toState = useSceneEditor((s) => s.toState);
  const markSaved = useSceneEditor((s) => s.markSaved);
  const reset = useSceneEditor((s) => s.reset);
  const canvas = useSceneEditor((s) => s.canvas);

  // Muat project dari query, atau reset scene baru.
  useEffect(() => {
    let active = true;
    if (projectIdParam) {
      api.projects
        .get(projectIdParam)
        .then((p) => {
          if (active) loadState(p.state as SceneState, p.id, p.title);
        })
        .catch((err) => {
          const msg = err instanceof ApiRequestError ? err.message : 'Gagal memuat project.';
          toast({ title: 'Tidak dapat membuka project', description: msg, variant: 'danger' });
        });
    } else {
      reset();
    }
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdParam]);

  // Fit canvas ke viewport tersedia (responsif sederhana).
  useEffect(() => {
    function recompute() {
      const availW = window.innerWidth - 320 - 64; // sidebar panel + padding
      const availH = window.innerHeight - 56 - 96;
      const next = Math.min(1, availW / canvas.width, availH / canvas.height);
      setScale(Math.max(0.2, next));
    }
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [canvas.width, canvas.height]);

  function handleExport(format: ExportFormat) {
    if (!stageRef.current) return;
    exportStage(stageRef.current, format, title || 'nesomn-scene');
    toast({ title: 'Export dimulai', description: `Mengunduh ${format.toUpperCase()} (maks 1080p).` });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const state = toState();
      if (projectId) {
        const updated = await api.projects.update(projectId, { title, state });
        markSaved(updated.id, updated.title);
        toast({ title: 'Tersimpan', description: 'Perubahan project disimpan.' });
      } else {
        const created = await api.projects.create({ title, kind: 'scene2d', state });
        markSaved(created.id, created.title);
        setSearchParams({ project: created.id }, { replace: true });
        toast({ title: 'Project dibuat', description: 'Scene baru tersimpan.' });
      }
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Gagal menyimpan.';
      const hint = err instanceof ApiRequestError && err.status === 401 ? ' Login dulu untuk menyimpan.' : '';
      toast({ title: 'Gagal menyimpan', description: msg + hint, variant: 'danger' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Seo title="Scene Editor" description="Editor mockup 2D berbasis browser di Nesomn Studio." />
      <Topbar
        title="Scene Editor"
        left={
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'design' | 'colour')} className="ml-4">
            <TabsList>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="colour">Colour</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        right={<EditorToolbar onExport={handleExport} onSave={handleSave} saving={saving} />}
      />

      <div className="flex h-[calc(100%-3.5rem)]">
        {/* Area canvas */}
        <div className="flex flex-1 items-center justify-center overflow-auto bg-surface-2 p-8">
          <div className="shadow-2xl ring-1 ring-border" style={{ lineHeight: 0 }}>
            <SceneCanvas ref={stageRef} scale={scale} />
          </div>
        </div>

        {/* Panel kanan */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-surface">
          <div className="border-b border-border p-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nama project
            </label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} id="project-title" />
          </div>

          {tab === 'design' ? (
            <div className="flex flex-col gap-2 p-4">
              <Button id="add-design" variant="secondary" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Add Design
              </Button>
              <Button id="add-text" variant="ghost" onClick={() => addText('Teks baru')}>
                <Type className="size-4" />
                Add Text
              </Button>
            </div>
          ) : (
            <ColorPanel />
          )}
        </aside>
      </div>

      <AddDesignDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
