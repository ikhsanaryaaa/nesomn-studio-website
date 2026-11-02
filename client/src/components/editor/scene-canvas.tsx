import { useSceneImages } from '@/hooks/use-scene-images';
import { Button } from '@/components/ui/button';
import { forwardRef, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';
import { useSceneEditor } from '@/stores/scene-editor-store';
import { CanvasObject } from './canvas-object';

/**
 * Canvas Konva: stage berukuran tetap (sesuai state canvas) di tengah
 * viewport, dengan background, objek, dan transformer untuk objek terpilih.
 * Forward ref ke Stage agar parent bisa export via stage.toBlob().
 */
type Props = {
  /** Skala tampilan (fit-to-viewport); export tetap pakai ukuran asli. */
  scale: number;
};

export const SceneCanvas = forwardRef<Konva.Stage, Props>(function SceneCanvas({ scale }, ref) {
  const canvas = useSceneEditor((s) => s.canvas);
  const objects = useSceneEditor((s) => s.objects);
  const media = useSceneImages(objects);
  const stageNode = useRef<Konva.Stage | null>(null);
  const selectedId = useSceneEditor((s) => s.selectedId);
  const select = useSceneEditor((s) => s.select);
  const updateObject = useSceneEditor((s) => s.updateObject);

  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectedNodeRef = useRef<Konva.Node | null>(null);

  // Pasang transformer ke node terpilih setiap kali seleksi berubah.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (selectedId && selectedNodeRef.current) {
      tr.nodes([selectedNodeRef.current]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selectedId, objects]);

  useEffect(() => {
    // Size changes clear backing canvases; redraw before a later interaction.
    transformerRef.current?.getStage()?.draw();
  }, [scale, canvas.width, canvas.height]);

  useEffect(() => {
    stageNode.current?.setAttr('nesomnImagesReady', !media.loading && media.errors === 0);
  }, [media.loading, media.errors]);

  return (
    <>
      {media.loading && (
        <p role="status" className="editor-image-status">
          Loading scene images…
        </p>
      )}
      {media.errors > 0 && (
        <div role="alert" className="editor-image-error">
          {media.errors} images could not be loaded. Check their licenses or reopen the assets from
          the catalogue. Export is blocked until all images are ready.
          <Button variant="secondary" onClick={media.retry}>
            Retry images
          </Button>
        </div>
      )}
      <Stage
        ref={(node) => {
          stageNode.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        width={canvas.width * scale}
        height={canvas.height * scale}
        scaleX={scale}
        scaleY={scale}
        style={{ width: canvas.width * scale, height: canvas.height * scale }}
        onTouchStart={(e) => {
          if (e.target === e.target.getStage() || e.target.name() === 'bg') select(null);
        }}
        onMouseDown={(e) => {
          // Klik di area kosong (stage atau background rect) = deselect.
          if (e.target === e.target.getStage() || e.target.name() === 'bg') {
            select(null);
          }
        }}
      >
        <Layer>
          <Rect
            name="bg"
            x={0}
            y={0}
            width={canvas.width}
            height={canvas.height}
            fill={canvas.background}
          />
          {objects.map((obj) => (
            <CanvasObject
              key={obj.id}
              object={obj}
              image={media.images?.get(obj.src ?? '')}
              isSelected={obj.id === selectedId}
              onSelect={select}
              onChange={updateObject}
              nodeRef={(node) => {
                if (obj.id === selectedId) selectedNodeRef.current = node;
              }}
            />
          ))}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 8 || newBox.height < 8 ? oldBox : newBox
            }
          />
        </Layer>
      </Stage>
    </>
  );
});
