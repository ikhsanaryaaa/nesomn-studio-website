import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UploadCloud, ImageOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import { useSceneEditor } from '@/stores/scene-editor-store';

/**
 * Modal "Add your design / Import Files". Dua sumber: upload file lokal
 * (divalidasi format & ukuran) atau pilih dari Asset Library milik user.
 * Gambar dimasukkan ke canvas via store.addImage.
 */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddDesignDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const addImage = useSceneEditor((s) => s.addImage);

  const library = useQuery({
    queryKey: ['library'],
    queryFn: () => api.library(),
    enabled: open,
  });

  function loadIntoCanvas(src: string) {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      addImage(src, img.naturalWidth, img.naturalHeight);
      onOpenChange(false);
    };
    img.onerror = () =>
      toast({ title: 'Gagal memuat gambar', description: 'Sumber tidak valid.', variant: 'danger' });
    img.src = src;
  }

  function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast({
        title: 'Format tidak didukung',
        description: 'Gunakan PNG, JPG, WEBP, atau SVG.',
        variant: 'danger',
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: 'File terlalu besar',
        description: 'Maksimal 10MB.',
        variant: 'danger',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => loadIntoCanvas(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add your design</DialogTitle>
          <DialogDescription>
            Import file dari perangkat atau pilih dari Asset Library Anda.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="import">
          <TabsList>
            <TabsTrigger value="import">Import Files</TabsTrigger>
            <TabsTrigger value="library">From Library</TabsTrigger>
          </TabsList>

          <TabsContent value="import">
            <button
              id="dropzone"
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              className={`flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                dragOver ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/60'
              }`}
            >
              <UploadCloud className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">Tarik file ke sini atau klik untuk pilih</span>
              <span className="text-xs text-muted-foreground">PNG, JPG, WEBP, SVG - maks 10MB</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </TabsContent>

          <TabsContent value="library">
            {library.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Memuat library...</p>
            ) : library.data && library.data.length > 0 ? (
              <div className="grid max-h-72 grid-cols-3 gap-3 overflow-y-auto">
                {library.data.map((item) => {
                  const preview = item.previews?.[0];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!preview}
                      onClick={() => preview && loadIntoCanvas(preview)}
                      className="group overflow-hidden rounded-lg border border-border bg-surface-3 transition-colors hover:border-accent disabled:opacity-50"
                    >
                      {preview ? (
                        <img
                          src={preview}
                          alt={item.title}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <span className="flex aspect-square w-full items-center justify-center">
                          <ImageOff className="size-5 text-muted-foreground" />
                        </span>
                      )}
                      <span className="block truncate p-1.5 text-xs">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Library kosong. Klaim aset gratis di Marketplace dulu.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
