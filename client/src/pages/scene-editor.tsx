import { Layers, Image as ImageIcon, Plus } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Seo } from '@/components/seo';

export default function SceneEditorPage() {
  return (
    <>
      <Seo
        title="Scene Editor"
        description="Editor mockup 2D berbasis browser di Nesomn Studio."
      />
      <Topbar
        title="Scene Editor"
        left={
          <Tabs defaultValue="design" className="ml-4">
            <TabsList>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="colour">Colour</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        right={<Button size="sm">Export</Button>}
      />
      <div className="flex h-[calc(100%-3.5rem)] items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-surface-2">
            <Layers className="size-7 text-muted-foreground" />
          </span>
          <h1 className="text-xl font-semibold">Mulai desain Anda</h1>
          <p className="text-sm text-muted-foreground">
            Canvas Konva akan tampil di sini. Tambahkan desain, atur layer, dan
            ekspor hasil. Editor fungsional menyusul di milestone berikutnya.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary">
              <Plus />
              Add Design
            </Button>
            <Button variant="ghost">
              <ImageIcon />
              Import Files
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
