import { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Text as KonvaText } from 'react-konva';
import type Konva from 'konva';
import type { SceneObject } from '@nesomn/shared';

/**
 * Render satu node canvas (image atau text) dan binding transform
 * kembali ke store saat selesai drag/transform. Komponen ini sengaja
 * "dumb": semua mutasi state lewat callback dari parent.
 */
type Props = {
  object: SceneObject;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<SceneObject>) => void;
  nodeRef?: (node: Konva.Node | null) => void;
};

/** Hook kecil untuk memuat HTMLImageElement dari src (data URL / URL). */
function useImage(src?: string): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(undefined);
  useEffect(() => {
    if (!src) return;
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = src;
    image.onload = () => setImg(image);
    return () => {
      image.onload = null;
    };
  }, [src]);
  return img;
}

export function CanvasObject({ object, isSelected, onSelect, onChange, nodeRef }: Props) {
  const shapeRef = useRef<Konva.Image | Konva.Text | null>(null);
  const image = useImage(object.type === 'image' ? object.src : undefined);

  useEffect(() => {
    if (isSelected && nodeRef) nodeRef(shapeRef.current);
  }, [isSelected, nodeRef, image]);

  const common = {
    x: object.x,
    y: object.y,
    rotation: object.rotation,
    opacity: object.opacity,
    draggable: true,
    onMouseDown: () => onSelect(object.id),
    onTap: () => onSelect(object.id),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) =>
      onChange(object.id, { x: e.target.x(), y: e.target.y() }),
    onTransformEnd: () => {
      const node = shapeRef.current;
      if (!node) return;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange(object.id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(8, node.width() * scaleX),
        height: Math.max(8, node.height() * scaleY),
        rotation: node.rotation(),
      });
    },
  };

  if (object.type === 'text') {
    return (
      <KonvaText
        ref={(n) => {
          shapeRef.current = n;
        }}
        {...common}
        text={object.text ?? ''}
        fontSize={object.fontSize ?? 32}
        fill={object.fill ?? '#111111'}
        width={object.width}
      />
    );
  }

  if (!image) return null;
  return (
    <KonvaImage
      ref={(n) => {
        shapeRef.current = n;
      }}
      {...common}
      image={image}
      width={object.width}
      height={object.height}
    />
  );
}
