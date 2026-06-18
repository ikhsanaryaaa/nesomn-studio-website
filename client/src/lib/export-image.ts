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
): void {
  // Reset scale tampilan supaya export memakai ukuran canvas asli.
  const prevScale = { x: stage.scaleX(), y: stage.scaleY() };
  stage.scale({ x: 1, y: 1 });

  const width = stage.width();
  const height = stage.height();
  const pixelRatio = clampPixelRatio(width, height);

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const dataUrl = stage.toDataURL({
    mimeType,
    quality: format === 'jpeg' ? 0.92 : 1,
    pixelRatio,
  });

  // Kembalikan scale tampilan.
  stage.scale(prevScale);

  const link = document.createElement('a');
  link.download = `${fileName}.${format === 'jpeg' ? 'jpg' : 'png'}`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
