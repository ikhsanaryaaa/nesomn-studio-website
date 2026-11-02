import { useSceneEditor } from '@/stores/scene-editor-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/** Inspector edits the existing object format; list order remains paint order. */
export function SceneInspector() {
  const objects = useSceneEditor((s) => s.objects);
  const selectedId = useSceneEditor((s) => s.selectedId);
  const select = useSceneEditor((s) => s.select);
  const update = useSceneEditor((s) => s.updateObject);
  const selected = objects.find((o) => o.id === selectedId);
  return (
    <section className="mt-4 space-y-3" aria-label="Layers dan properties">
      <h3 className="text-sm font-semibold">Layers</h3>
      {!objects.length && (
        <p className="text-sm text-muted-foreground">Tambahkan design atau teks untuk mulai.</p>
      )}
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {[...objects].reverse().map((o, i) => (
          <li key={o.id}>
            <Button
              className="w-full justify-start truncate"
              variant={o.id === selectedId ? 'secondary' : 'ghost'}
              aria-pressed={o.id === selectedId}
              onClick={() => select(o.id)}
            >
              {o.type === 'text' ? o.text || 'Teks' : `Image ${objects.length - i}`}
            </Button>
          </li>
        ))}
      </ul>
      {selected && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Properties</legend>
          {selected.type === 'text' && (
            <label className="block text-xs">
              Teks
              <Input
                value={selected.text ?? ''}
                onChange={(e) => update(selected.id, { text: e.target.value })}
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            {(['x', 'y', 'width', 'height', 'rotation', 'opacity'] as const).map((key) => (
              <label key={key} className="block text-xs">
                {key}
                <Input
                  type="number"
                  step={key === 'opacity' ? 0.1 : 1}
                  min={key === 'width' || key === 'height' ? 8 : key === 'opacity' ? 0 : undefined}
                  max={key === 'opacity' ? 1 : undefined}
                  value={selected[key]}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    if (
                      !Number.isFinite(value) ||
                      ((key === 'width' || key === 'height') && value < 8) ||
                      (key === 'opacity' && (value < 0 || value > 1))
                    )
                      return;
                    update(selected.id, { [key]: value });
                  }}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </section>
  );
}
