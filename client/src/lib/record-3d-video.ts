/**
 * Rekam video turntable dari canvas WebGL ke WebM via MediaRecorder.
 * Resolusi mengikuti canvas (DPR sudah dibatasi <= 2, target <= 1080p).
 * Durasi singkat untuk satu putaran penuh. Client-side, tanpa server.
 */

export type RecordOptions = {
  /** Durasi rekaman dalam milidetik. */
  durationMs?: number;
  /** Frame per detik target. */
  fps?: number;
  fileName?: string;
};

/** Pilih mime WebM yang didukung browser. */
function pickMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return 'video/webm';
}

/**
 * Mulai merekam canvas selama durasi tertentu, lalu unduh hasilnya.
 * `onTick` dipanggil tiap frame dengan progres 0..1 agar pemanggil
 * dapat memutar kamera/model (turntable) selama perekaman.
 */
export function recordTurntable(
  canvas: HTMLCanvasElement,
  onTick: (progress: number) => void,
  options: RecordOptions = {},
): Promise<void> {
  const { durationMs = 4000, fps = 30, fileName = 'nesomn-3d' } = options;

  return new Promise((resolve, reject) => {
    let stream: MediaStream;
    try {
      stream = canvas.captureStream(fps);
    } catch (err) {
      reject(err);
      return;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: pickMimeType(),
      videoBitsPerSecond: 8_000_000,
    });
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fileName}.webm`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      resolve();
    };

    const start = performance.now();
    let raf = 0;
    const loop = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / durationMs);
      onTick(progress);
      if (progress < 1) {
        raf = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(raf);
        recorder.stop();
      }
    };

    recorder.start();
    loop();
  });
}
