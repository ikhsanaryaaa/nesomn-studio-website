export type RecordOptions = {
  durationMs?: number;
  fps?: number;
  fileName?: string;
  signal?: AbortSignal;
};
function recordOnce(
  canvas: HTMLCanvasElement,
  onTick: (progress: number) => void,
  options: RecordOptions = {},
): Promise<void> {
  const { durationMs = 4000, fps = 30, fileName = 'nesomn-3d', signal } = options;
  return new Promise((resolve, reject) => {
    let stream: MediaStream | undefined,
      recorder: MediaRecorder | undefined,
      raf = 0,
      finished = false;
    const copy = document.createElement('canvas');
    const scale = Math.min(1, 1080 / Math.max(canvas.width, canvas.height));
    copy.width = Math.max(1, Math.round(canvas.width * scale));
    copy.height = Math.max(1, Math.round(canvas.height * scale));
    const context = copy.getContext('2d');
    const cleanup = () => {
      copy.remove();
      cancelAnimationFrame(raf);
      signal?.removeEventListener('abort', abort);
      stream?.getTracks().forEach((track) => track.stop());
    };
    const fail = (error: unknown) => {
      if (finished) return;
      finished = true;
      try {
        if (recorder && recorder.state !== 'inactive') recorder.stop();
      } catch {
        /* still release tracks and RAF */
      }
      cleanup();
      reject(error);
    };
    const abort = () => fail(new DOMException('Rekaman dibatalkan.', 'AbortError'));
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    try {
      if (!context || typeof MediaRecorder === 'undefined')
        throw Error('MediaRecorder tidak tersedia.');
      context.drawImage(canvas, 0, 0, copy.width, copy.height);
      // Explicit frame requests work on offscreen/headless compositors as well.
      copy.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none';
      document.body.appendChild(copy);
      stream = copy.captureStream(0);
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mime) throw Error('WebM tidak didukung.');
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8000000 });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => fail(Error('Perekaman gagal.'));
      recorder.onstop = () => {
        if (finished) return;
        finished = true;
        cleanup();
        const blob = new Blob(chunks, { type: mime });
        if (blob.size < 1024) {
          reject(Error('Tidak ada frame video yang dapat direkam.'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName + '.webm';
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      };
      const start = performance.now();
      let lastFrame = -Infinity;
      const loop = () => {
        if (finished) return;
        try {
          const progress = Math.min(1, (performance.now() - start) / durationMs);
          onTick(progress);
          if (performance.now() - lastFrame >= 1000 / fps) {
            context.drawImage(canvas, 0, 0, copy.width, copy.height);
            (stream!.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack).requestFrame();
            lastFrame = performance.now();
          }
          if (progress < 1) raf = requestAnimationFrame(loop);
          else recorder!.stop();
        } catch (error) {
          fail(error);
        }
      };
      recorder.start(250);
      raf = requestAnimationFrame(loop);
    } catch (error) {
      fail(error);
    }
  });
}

export async function recordTurntable(
  canvas: HTMLCanvasElement,
  onTick: (progress: number) => void,
  options: RecordOptions = {},
): Promise<void> {
  try {
    await recordOnce(canvas, onTick, options);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Tidak ada frame video yang dapat direkam.' &&
      !options.signal?.aborted
    ) {
      await recordOnce(canvas, onTick, options);
    } else throw error;
  }
}
