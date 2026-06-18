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
    <div className="flex flex-col gap-6 p-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Warna objek
        </h3>
        {selected ? (
          canFill ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-5 gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => setFill(selected.id, c)}
                    className={`size-8 rounded-md border transition-transform hover:scale-110 ${
                      selected.fill === c ? 'border-accent ring-2 ring-accent' : 'border-border'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Kustom</span>
                <input
                  type="color"
                  value={selected.fill ?? '#111111'}
                  onChange={(e) => setFill(selected.id, e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
                />
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Objek gambar tidak punya warna isi. Pilih objek teks untuk mengubah warna.
            </p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Pilih objek dulu untuk ganti warna.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Background canvas
        </h3>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-5 gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => setBackground(c)}
                className={`size-8 rounded-md border transition-transform hover:scale-110 ${
                  canvas.background === c ? 'border-accent ring-2 ring-accent' : 'border-border'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Kustom</span>
            <input
              type="color"
              value={canvas.background}
              onChange={(e) => setBackground(e.target.value)}
              className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
