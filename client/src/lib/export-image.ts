import type Konva from 'konva';

/**
 * Export stage Konva ke PNG/JPEG lalu trigger download.
 * Resolusi dibatasi maksimal 1080p (PRD: render <= 1080p, client-side).
 * pixelRatio dihitung agar sisi terpanjang output <= 1080px tanpa
 * memperbesar di atas ukuran asli canvas.
 */

const MAX_DIMENSION = 1080;

export type ExportFormat = 'png' | 'jpeg';

/** Hitung pixelRatio agar output tidak melebihi 1080p. */
export function clampPixelRatio(width: number, height: number): number {
  const longest = Math.max(width, height);
  if (longest <= 0) return 1;
  return Math.min(1, MAX_DIMENSION / longest);
}

export function exportStage(
  stage: Konva.Stage,
  format: ExportFormat,
  fileName = 'nesomn-scene',
  logicalSize?: { width: number; height: number },
): void {
  const previousScale = stage.scale();
  const previousSize = stage.size();
  const size = logicalSize ?? previousSize;
  const transformers = stage.find('Transformer');
  const visibility = transformers.map((node) => node.visible());
  let dataUrl: string;
  try {
    stage.scale({ x: 1, y: 1 });
    stage.size(size);
    transformers.forEach((node) => node.hide());
    dataUrl = stage.toDataURL({
      mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
      quality: format === 'jpeg' ? 0.92 : 1,
      pixelRatio: clampPixelRatio(size.width, size.height),
    });
  } finally {
    stage.size(previousSize);
    stage.scale(previousScale);
    transformers.forEach((node, index) => node.visible(visibility[index]));
    stage.batchDraw();
  }
  const link = document.createElement('a');
  link.download = `${fileName}.${format === 'jpeg' ? 'jpg' : 'png'}`;
  link.href = dataUrl;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
}
