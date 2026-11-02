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
    <section className="editor-inspector" aria-label="Layers and properties">
      <h3 className="editor-panel-title">Layers</h3>
      {!objects.length && (
        <p className="editor-description">Add a design or text to get started.</p>
      )}
      <ul className="editor-layer-list">
        {[...objects].reverse().map((o, i) => (
          <li key={o.id}>
            <Button
              className="editor-layer-action"
              variant={o.id === selectedId ? 'secondary' : 'ghost'}
              aria-pressed={o.id === selectedId}
              onClick={() => select(o.id)}
            >
              {o.type === 'text' ? o.text || 'Text' : `Image ${objects.length - i}`}
            </Button>
          </li>
        ))}
      </ul>
      {selected && (
        <fieldset className="editor-properties">
          <legend className="editor-panel-title">Properties</legend>
          {selected.type === 'text' && (
            <label className="editor-property-label">
              Text
              <Input
                value={selected.text ?? ''}
                onChange={(e) => update(selected.id, { text: e.target.value })}
              />
            </label>
          )}
          <div className="editor-property-grid">
            {(['x', 'y', 'width', 'height', 'rotation', 'opacity'] as const).map((key) => (
              <label key={key} className="editor-property-label">
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
