import { useSceneEditor } from '@/stores/scene-editor-store';

/**
 * Panel Colour: ganti warna objek terpilih (fill) dan background canvas.
 * Swatch memakai palet token + input warna kustom. Untuk image, fill
 * tidak diterapkan (hanya text yang punya warna isi).
 */
const SWATCHES = [
  '#111111',
  '#ffffff',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#6366f1',
  '#a855f7',
  '#ec4899',
];

export function ColorPanel() {
  const selectedId = useSceneEditor((s) => s.selectedId);
  const objects = useSceneEditor((s) => s.objects);
  const canvas = useSceneEditor((s) => s.canvas);
  const setFill = useSceneEditor((s) => s.setFill);
  const setBackground = useSceneEditor((s) => s.setBackground);

  const selected = objects.find((o) => o.id === selectedId);
  const canFill = selected?.type === 'text';

  return (
    <div className="editor-color-panel">
      <section>
        <h3 className="editor-section-title">Object color</h3>
        {selected ? (
          canFill ? (
            <div className="editor-control-stack">
              <div className="editor-swatches">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => setFill(selected.id, c)}
                    className={`editor-color-swatch ${
                      selected.fill === c ? 'editor-color-swatch--selected' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <label className="editor-custom-color">
                <span className="editor-muted">Custom</span>
                <input
                  type="color"
                  value={selected.fill ?? '#111111'}
                  onChange={(e) => setFill(selected.id, e.target.value)}
                  className="editor-color-input"
                />
              </label>
            </div>
          ) : (
            <p className="editor-description">
              Image objects do not have a fill color. Select a text object to change its color.
            </p>
          )
        ) : (
          <p className="editor-description">Select an object to change its color.</p>
        )}
      </section>

      <section>
        <h3 className="editor-section-title">Canvas background</h3>
        <div className="editor-control-stack">
          <div className="editor-swatches">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => setBackground(c)}
                className={`editor-color-swatch ${
                  canvas.background === c ? 'editor-color-swatch--selected' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <label className="editor-custom-color">
            <span className="editor-muted">Custom</span>
            <input
              type="color"
              value={canvas.background}
              onChange={(e) => setBackground(e.target.value)}
              className="editor-color-input"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
