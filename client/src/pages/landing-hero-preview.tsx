import {
  ArrowUpRight,
  Box,
  Check,
  Eye,
  Image,
  Layers,
  MousePointer2,
  Move,
  Plus,
  Redo2,
  SlidersHorizontal,
  Type,
  Undo2,
} from 'lucide-react';
import './landing-hero-preview.css';

function Artwork({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'hero-artwork hero-artwork-compact' : 'hero-artwork'}>
      <div className="hero-artwork-brand">
        <span>NESOMN /</span>
        <span>STUDIO KIT</span>
      </div>
      <div className="hero-artwork-title">
        STUDIO
        <br />
        KIT.
      </div>
      <div className="hero-artwork-orbit">
        <i />
        <i />
        <i />
      </div>
      <div className="hero-artwork-foot">
        <span>
          FOR YOUR
          <br />
          NEXT IDEA.
        </span>
        <span>01</span>
      </div>
    </div>
  );
}

/** Illustrative sample, not a second editor or a simulated saved user project. */
export function LandingHeroPreview({ shopUrl }: { shopUrl: string }) {
  return (
    <figure
      className="hero-workflow"
      aria-label="Demo: a Nesomn scene design and a matching packaging mockup"
    >
      <div className="hero-editor-window" aria-hidden="true">
        <div className="hero-editor-titlebar">
          <span className="hero-window-brand">
            <Layers size={15} /> Nesomn Studio
          </span>
          <span className="hero-sample-label">Demo / Sample</span>
        </div>
        <div className="hero-editor-toolbar">
          <span className="hero-project-name">
            Nesomn Studio Kit <span>.scene</span>
          </span>
          <div className="hero-editor-history">
            <Undo2 size={13} />
            <Redo2 size={13} />
            <span className="hero-scene-status">
              <Check size={12} /> Scene preview
            </span>
          </div>
        </div>
        <div className="hero-editor-body">
          <div className="hero-layers">
            <div className="hero-panel-title">
              Layers <Plus size={12} />
            </div>
            <span className="hero-layer-selected">
              <Type size={13} /> Typography <Eye size={11} />
            </span>
            <span>
              <Image size={13} /> Artwork <Eye size={11} />
            </span>
            <span>
              <Layers size={13} /> Background <Eye size={11} />
            </span>
            <div className="hero-layer-colours">
              <i />
              <i />
              <i />
            </div>
            <div className="hero-layer-note">
              YOUR SPACE.
              <br />
              YOUR PERSPECTIVE.
            </div>
          </div>
          <div className="hero-editor-canvas">
            <div className="hero-canvas-tools">
              <span>
                <MousePointer2 size={14} />
              </span>
              <Move size={14} />
              <Type size={14} />
              <Image size={14} />
            </div>
            <div className="hero-poster">
              <Artwork />
              <span className="hero-selection-label">Typography</span>
              <i className="hero-selection-corner" />
              <i className="hero-selection-corner" />
              <i className="hero-selection-corner" />
              <i className="hero-selection-corner" />
            </div>
            <div className="hero-canvas-bottom">
              <span>Scene Editor / 2D</span>
              <span>Fit to canvas</span>
            </div>
          </div>
          <div className="hero-inspector">
            <SlidersHorizontal size={14} />
            <span>Aa</span>
            <i />
            <i />
            <i />
            <span className="hero-inspector-swatch" />
          </div>
        </div>
      </div>
      <div className="hero-result">
        <div className="hero-result-heading">
          <span>
            <Box size={14} /> A new dimension.
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </div>
        <div className="hero-result-stage" aria-hidden="true">
          <span className="hero-result-shadow" />
          <div className="hero-package">
            <div className="hero-package-front">
              <Artwork compact />
            </div>
            <div className="hero-package-side">
              <span>
                NESOMN
                <br />
                STUDIO
              </span>
            </div>
            <div className="hero-package-top">NESOMN STUDIO KIT</div>
          </div>
        </div>
        <div className="hero-result-caption">
          <span>Studio Kit</span>
          <span>Internal concept</span>
        </div>
      </div>
      <figcaption className="hero-workflow-caption">
        <span>
          One idea. A whole new perspective.<small>Illustrative workspace · Demo / Sample</small>
        </span>
        <a href={shopUrl + '/demo/3d?model=nesomn-studio-kit'}>
          Try in 3D <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </figcaption>
    </figure>
  );
}
