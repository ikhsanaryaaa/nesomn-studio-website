import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { WebGLRenderer } from 'three';
import { Camera, Video, Save } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Seo } from '@/components/seo';
import { useToast } from '@/components/ui/use-toast';
import { Scene3DViewport } from '@/components/editor3d/scene-3d-viewport';
import { ControlsPanel3D } from '@/components/editor3d/controls-panel-3d';
import { AddDesign3DDialog } from '@/components/editor3d/add-design-3d-dialog';
import { useScene3DEditor } from '@/stores/scene-3d-store';
import { exportRendererImage, type ExportImageFormat } from '@/lib/export-3d';
import { recordTurntable } from '@/lib/record-3d-video';
import { api, ApiRequestError } from '@/lib/api';
import type { Scene3DState } from '@nesomn/shared';

/**
 * 3D Editor: viewport R3F + panel Design/Colour, simpan/muat project 3D.
 * Buka project tersimpan via query `?project=<id>`. Tanpa AI (M6).
 */
export default function Editor3DPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdParam = searchParams.get('project');

  const glRef = useRef<WebGLRenderer | null>(null);
  const [tab, setTab] = useState<'design' | 'colour'>('design');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  const title = useScene3DEditor((s) => s.title);
  const projectId = useScene3DEditor((s) => s.projectId);
  const setTitle = useScene3DEditor((s) => s.setTitle);
  const loadState = useScene3DEditor((s) => s.loadState);
  const toState = useScene3DEditor((s) => s.toState);
  const markSaved = useScene3DEditor((s) => s.markSaved);
  const reset = useScene3DEditor((s) => s.reset);

  // Muat project 3D dari query, atau reset scene baru.
  useEffect(() => {
    let active = true;
    if (projectIdParam) {
      api.projects
        .get(projectIdParam)
        .then((p) => {
          if (active) loadState(p.state as Scene3DState, p.id, p.title);
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

  function handleExportImage(format: ExportImageFormat) {
    if (!glRef.current) return;
    exportRendererImage(glRef.current, format, title || 'nesomn-3d');
    toast({ title: 'Export dimulai', description: `Mengunduh ${format.toUpperCase()} (maks 1080p).` });
  }

  async function handleRenderVideo() {
    if (!glRef.current || recording) return;
    const canvas = glRef.current.domElement;
    setRecording(true);
    setAutoRotate(true);
    try {
      await recordTurntable(canvas, () => {}, { durationMs: 4000, fps: 30, fileName: title || 'nesomn-3d' });
      toast({ title: 'Video tersimpan', description: 'Turntable WebM diunduh (maks 1080p).' });
    } catch {
      toast({ title: 'Gagal merekam', description: 'Browser tidak mendukung perekaman canvas.', variant: 'danger' });
    } finally {
      setRecording(false);
      setAutoRotate(false);
    }
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
        const created = await api.projects.create({ title, kind: 'scene3d', state });
        markSaved(created.id, created.title);
        setSearchParams({ project: created.id }, { replace: true });
        toast({ title: 'Project dibuat', description: 'Scene 3D baru tersimpan.' });
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
      <Seo title="3D Editor" description="Editor mockup 3D berbasis browser di Nesomn Studio." />
      <Topbar
        title="3D Editor"
        left={
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'design' | 'colour')} className="ml-4">
            <TabsList>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="colour">Colour</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        right={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Camera className="size-4" />
                  Render Image
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportImage('png')}>PNG</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportImage('jpeg')}>JPEG</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="secondary" onClick={handleRenderVideo} disabled={recording}>
              <Video className="size-4" />
              {recording ? 'Merekam...' : 'Render Video'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="size-4" />
              {saving ? 'Menyimpan...' : 'Save'}
            </Button>
          </>
        }
      />

      <div className="flex h-[calc(100%-3.5rem)]">
        {/* Viewport 3D */}
        <div className="flex-1 bg-surface-2">
          <Scene3DViewport onGlReady={(gl) => (glRef.current = gl)} autoRotate={autoRotate} />
        </div>

        {/* Panel kanan */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-surface">
          <div className="border-b border-border p-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nama project
            </label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} id="project-title-3d" />
          </div>
          <ControlsPanel3D tab={tab} onAddDesign={() => setAddOpen(true)} />
        </aside>
      </div>

      <AddDesign3DDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
