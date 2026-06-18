import type { CameraPreset } from '@nesomn/shared';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useScene3DEditor } from '@/stores/scene-3d-store';

/**
 * Panel kontrol editor 3D: tab Design (decal) dan Colour (material +
 * background), slider Grain, dan preset Camera Angle. Tanpa AI.
 */

const SWATCHES = [
  '#111111',
  '#ffffff',
  '#d6d3cc',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#6366f1',
  '#a855f7',
];

const CAMERA_PRESETS: { value: CameraPreset; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'threeQuarter', label: '3/4' },
  { value: 'side', label: 'Side' },
  { value: 'top', label: 'Top' },
];

type Props = {
  tab: 'design' | 'colour';
  onAddDesign: () => void;
};

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onPick(c)}
            className={`size-8 rounded-md border transition-transform hover:scale-110 ${
              value.toLowerCase() === c.toLowerCase()
                ? 'border-accent ring-2 ring-accent'
                : 'border-border'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Kustom</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
        />
      </label>
    </div>
  );
}

export function ControlsPanel3D({ tab, onAddDesign }: Props) {
  const materialColor = useScene3DEditor((s) => s.materialColor);
  const background = useScene3DEditor((s) => s.background);
  const grain = useScene3DEditor((s) => s.grain);
  const camera = useScene3DEditor((s) => s.camera);
  const decals = useScene3DEditor((s) => s.decals);
  const setMaterialColor = useScene3DEditor((s) => s.setMaterialColor);
  const setBackground = useScene3DEditor((s) => s.setBackground);
  const setGrain = useScene3DEditor((s) => s.setGrain);
  const setCamera = useScene3DEditor((s) => s.setCamera);
  const removeDecal = useScene3DEditor((s) => s.removeDecal);

  if (tab === 'design') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Button id="add-design-3d" variant="secondary" onClick={onAddDesign}>
          <Plus className="size-4" />
          Add Design
        </Button>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Decals ({decals.length})
          </h3>
          {decals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada desain. Tambahkan untuk menempel ke permukaan model.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {decals.map((d, i) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
                >
                  <span className="truncate">Decal {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeDecal(d.id)}
                    className="text-xs text-muted-foreground hover:text-danger"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Camera Angle
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {CAMERA_PRESETS.map((p) => (
              <Button
                key={p.value}
                variant={camera === p.value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setCamera(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Warna objek
        </h3>
        <Swatches value={materialColor} onPick={setMaterialColor} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Background
        </h3>
        <Swatches value={background} onPick={setBackground} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Grain
          </h3>
          <span className="font-mono text-xs text-foreground">{grain}</span>
        </div>
        <Slider
          value={[grain]}
          onValueChange={(v) => setGrain(v[0])}
          max={100}
          step={1}
        />
      </section>
    </div>
  );
}
