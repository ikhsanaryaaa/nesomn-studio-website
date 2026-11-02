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
  meshes?: { path: string; name: string }[];
  tab: 'design' | 'colour';
  onAddDesign: () => void;
};

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="editor-control-stack">
      <div className="editor-swatches">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onPick(c)}
            className={`editor-color-swatch ${
              value.toLowerCase() === c.toLowerCase() ? 'editor-color-swatch--selected' : ''
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <label className="editor-custom-color">
        <span className="editor-muted">Custom</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onPick(e.target.value)}
          className="editor-color-input"
        />
      </label>
    </div>
  );
}

export function ControlsPanel3D({ tab, onAddDesign, meshes = [] }: Props) {
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
  const selected = useScene3DEditor((s) => s.selectedDecalId);
  const select = useScene3DEditor((s) => s.selectDecal);
  const update = useScene3DEditor((s) => s.updateDecal);
  const decal = decals.find((d) => d.id === selected);

  if (tab === 'design') {
    return (
      <div className="editor-tool-panel">
        <Button id="add-design-3d" variant="secondary" onClick={onAddDesign}>
          <Plus className="editor-action-icon" />
          Add Design
        </Button>
        {decal && (
          <section className="editor-control-stack" aria-label="Decal properties">
            <h3 className="editor-strong">Decal properties</h3>
            <label className="editor-text">
              Target mesh
              <select
                className="theme-select editor-mesh-select"
                value={decal.meshPath ?? ''}
                onChange={(e) => update(decal.id, { meshPath: e.target.value || undefined })}
              >
                <option value="">Automatic (largest mesh)</option>
                {meshes.map((m) => (
                  <option key={m.path} value={m.path}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            {(['position', 'rotation'] as const).map((field) => (
              <div key={field}>
                <span className="editor-text">
                  {field === 'position' ? 'Local position' : 'Rotation (radians)'}
                </span>
                <div className="editor-axis-grid">
                  {[0, 1, 2].map((axis) => (
                    <label key={axis} className="editor-caption">
                      {['X', 'Y', 'Z'][axis]}
                      <input
                        type="number"
                        className="editor-number-input"
                        step="0.1"
                        value={decal[field][axis]}
                        onChange={(e) => {
                          const n = e.target.valueAsNumber;
                          if (!Number.isFinite(n)) return;
                          const next = [...decal[field]] as [number, number, number];
                          next[axis] = n;
                          update(decal.id, { [field]: next });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <label className="editor-text">
              Scale
              <input
                type="number"
                className="editor-number-input"
                min="0.01"
                max="100"
                step="0.1"
                value={decal.scale}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  if (Number.isFinite(n) && n > 0 && n <= 100) update(decal.id, { scale: n });
                }}
              />
            </label>
          </section>
        )}

        <section>
          <h3 className="editor-section-title">Decals ({decals.length})</h3>
          {decals.length === 0 ? (
            <p className="editor-description">
              No designs yet. Add one to place it on the model surface.
            </p>
          ) : (
            <ul className="editor-result-stack">
              {decals.map((d, i) => (
                <li key={d.id} className="editor-decal-row">
                  <button
                    className="editor-decal-select"
                    aria-pressed={selected === d.id}
                    onClick={() => select(d.id)}
                  >
                    Decal {i + 1}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDecal(d.id)}
                    className="editor-decal-remove"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="editor-section-title">Camera Angle</h3>
          <div className="editor-paired-controls">
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
    <div className="editor-color-panel">
      <section>
        <h3 className="editor-section-title">Object color</h3>
        <Swatches value={materialColor} onPick={setMaterialColor} />
      </section>

      <section>
        <h3 className="editor-section-title">Background</h3>
        <Swatches value={background} onPick={setBackground} />
      </section>

      <section>
        <div className="editor-control-heading">
          <h3 className="editor-control-title">Grain</h3>
          <span className="editor-control-value">{grain}</span>
        </div>
        <Slider value={[grain]} onValueChange={(v) => setGrain(v[0])} max={100} step={1} />
      </section>
    </div>
  );
}
