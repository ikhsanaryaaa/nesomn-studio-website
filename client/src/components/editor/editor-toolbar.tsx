import { Copy, Trash2, Undo2, Redo2, Download, Save, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSceneEditor } from '@/stores/scene-editor-store';
import type { ExportFormat } from '@/lib/export-image';

/**
 * Toolbar aksi editor: duplicate, delete, undo, redo, export, save.
 * Tombol struktural disable saat tidak relevan (mis. tidak ada seleksi).
 */
type Props = {
  onExport: (format: ExportFormat) => void;
  onSave: () => void;
  saving: boolean;
};

export function EditorToolbar({ onExport, onSave, saving }: Props) {
  const selectedId = useSceneEditor((s) => s.selectedId);
  const duplicate = useSceneEditor((s) => s.duplicate);
  const deleteSelected = useSceneEditor((s) => s.deleteSelected);
  const undo = useSceneEditor((s) => s.undo);
  const redo = useSceneEditor((s) => s.redo);
  const canUndo = useSceneEditor((s) => s.past.length > 0);
  const canRedo = useSceneEditor((s) => s.future.length > 0);

  return (
    <div className="flex items-center gap-1">
      <Button
        id="editor-duplicate"
        variant="ghost"
        size="icon"
        title="Duplicate"
        disabled={!selectedId}
        onClick={duplicate}
      >
        <Copy className="size-4" />
      </Button>
      <Button
        id="editor-delete"
        variant="ghost"
        size="icon"
        title="Delete"
        disabled={!selectedId}
        onClick={deleteSelected}
      >
        <Trash2 className="size-4" />
      </Button>
      <span className="mx-1 h-5 w-px bg-border" />
      <Button
        id="editor-undo"
        variant="ghost"
        size="icon"
        title="Undo"
        disabled={!canUndo}
        onClick={undo}
      >
        <Undo2 className="size-4" />
      </Button>
      <Button
        id="editor-redo"
        variant="ghost"
        size="icon"
        title="Redo"
        disabled={!canRedo}
        onClick={redo}
      >
        <Redo2 className="size-4" />
      </Button>
      <span className="mx-1 h-5 w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button id="editor-export" variant="secondary" size="sm">
            <Download className="size-4" />
            Export
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport('png')}>PNG</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('jpeg')}>JPEG</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button id="editor-save" size="sm" onClick={onSave} disabled={saving}>
        <Save className="size-4" />
        {saving ? 'Menyimpan...' : 'Save'}
      </Button>
    </div>
  );
}
