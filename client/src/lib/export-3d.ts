import type { WebGLRenderer } from 'three';

/**
 * Export image dari renderer R3F ke PNG/JPEG lalu trigger download.
 * Resolusi dibatasi maksimal 1080p (PRD: render <= 1080p, client-side).
 * Canvas memerlukan preserveDrawingBuffer=true agar buffer terbaca benar.
 */

const MAX_DIMENSION = 1080;

export type ExportImageFormat = 'png' | 'jpeg';

/** Hitung skala agar sisi terpanjang output tidak melebihi 1080px. */
export function clampScale(width: number, height: number): number {
  const longest = Math.max(width, height);
  if (longest <= 0) return 1;
  return Math.min(1, MAX_DIMENSION / longest);
}

export function exportRendererImage(
  gl: WebGLRenderer,
  format: ExportImageFormat,
  fileName = 'nesomn-3d',
): void {
  const source = gl.domElement;
  const scale = clampScale(source.width, source.height);

  // Salin ke canvas sementara dengan ukuran ter-clamp agar <= 1080p.
  const target = document.createElement('canvas');
  target.width = Math.round(source.width * scale);
  target.height = Math.round(source.height * scale);
  const ctx = target.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(source, 0, 0, target.width, target.height);

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const dataUrl = target.toDataURL(mimeType, format === 'jpeg' ? 0.92 : 1);

  const link = document.createElement('a');
  link.download = `${fileName}.${format === 'jpeg' ? 'jpg' : 'png'}`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
