import { editorEpoch } from '@/lib/editor-session';
import { useEffect, useRef, useState } from 'react';
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
import { useScene3DEditor } from '@/stores/scene-3d-store';

/**
 * Modal "Add your design" untuk editor 3D. Dua sumber: upload file lokal
 * (divalidasi format & ukuran) atau pilih dari Asset Library milik user.
 * Hasil ditempel sebagai decal ke permukaan model via store.addDecal.
 */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddDesign3DDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const readerRef = useRef<FileReader | null>(null);
  useEffect(
    () => () => {
      if (readerRef.current) {
        readerRef.current.onload = null;
        readerRef.current.abort();
      }
    },
    [],
  );
  useEffect(() => {
    if (!open && readerRef.current) {
      readerRef.current.onload = null;
      readerRef.current.abort();
    }
  }, [open]);
  const [dragOver, setDragOver] = useState(false);
  const addDecal = useScene3DEditor((s) => s.addDecal);

  const library = useQuery({
    queryKey: ['library'],
    queryFn: () => api.library(),
    enabled: open,
  });

  function applyDecal(src: string) {
    addDecal(src);
    onOpenChange(false);
    toast({
      title: 'Design added',
      description: 'The decal has been placed on the model surface.',
    });
  }

  function handleFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast({
        title: 'Unsupported format',
        description: 'Use PNG, JPG, WEBP, or SVG.',
        variant: 'danger',
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({
        title: 'File too large',
        description: 'Maximum file size: 10 MB.',
        variant: 'danger',
      });
      return;
    }
    const reader = new FileReader();
    readerRef.current?.abort();
    readerRef.current = reader;
    const epoch = editorEpoch();
    const version = useScene3DEditor.getState().documentVersion;
    reader.onload = () => {
      if (epoch === editorEpoch() && version === useScene3DEditor.getState().documentVersion)
        applyDecal(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="editor-import-dialog">
        <DialogHeader>
          <DialogTitle>Add your design</DialogTitle>
          <DialogDescription>
            Import a file from your device or choose one from your Asset Library.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="import">
          <TabsList>
            <TabsTrigger value="import">Import Files</TabsTrigger>
            <TabsTrigger value="library">From Library</TabsTrigger>
          </TabsList>

          <TabsContent value="import">
            <button
              id="dropzone-3d"
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
              className={`editor-import-dropzone ${dragOver ? 'editor-import-dropzone--over' : ''}`}
            >
              <UploadCloud className="editor-import-icon" />
              <span className="editor-label">Drop a file here or click to browse</span>
              <span className="editor-hint">PNG, JPG, WEBP, SVG — up to 10 MB</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              className="editor-file-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = '';
              }}
            />
          </TabsContent>

          <TabsContent value="library">
            {library.isLoading ? (
              <p className="editor-library-state">Loading your library…</p>
            ) : library.data && library.data.length > 0 ? (
              <div className="editor-library-grid">
                {library.data.map((item) => {
                  const preview = item.previews?.[0];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!preview}
                      onClick={() => preview && applyDecal(preview)}
                      className="editor-library-item"
                    >
                      {preview ? (
                        <img src={preview} alt={item.title} className="editor-library-preview" />
                      ) : (
                        <span className="editor-library-placeholder">
                          <ImageOff className="editor-placeholder-icon" />
                        </span>
                      )}
                      <span className="editor-library-title">{item.title}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="editor-library-state">
                Your library is empty. Claim a free asset in the Marketplace to get started.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
