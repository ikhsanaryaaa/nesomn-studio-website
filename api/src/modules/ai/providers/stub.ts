import type { AiJobInput } from '@nesomn/shared';
import type { AIProvider, GenerateResult, ProviderRow } from '../provider.ts';

/**
 * Provider stub untuk dev: mensimulasikan generasi tanpa biaya/eksternal.
 * Mengembalikan URL hasil placeholder. Dapat dipaksa gagal lewat prompt
 * yang memuat kata kunci '__fail__' agar jalur refund dapat diuji.
 */

/** Placeholder hasil per jenis output. Gambar/video contoh statis. */
const PLACEHOLDER_IMAGE =
  'https://placehold.co/1024x1024/1b1f2a/d6d3cc/png?text=AI+Scene';
const PLACEHOLDER_VIDEO =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

/** Jeda kecil untuk meniru waktu proses provider nyata. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class StubProvider implements AIProvider {
  readonly kind: ProviderRow['kind'];
  readonly tab: ProviderRow['tab'];

  constructor(row: Pick<ProviderRow, 'kind' | 'tab'>) {
    this.kind = row.kind;
    this.tab = row.tab;
  }

  async generate(input: AiJobInput): Promise<GenerateResult> {
    // Simulasi waktu proses (singkat agar test/manual cepat).
    await delay(800);

    // Jalur gagal terkontrol untuk menguji refund.
    if (typeof input.prompt === 'string' && input.prompt.includes('__fail__')) {
      throw new Error('Stub provider dipaksa gagal (uji refund).');
    }

    return {
      resultUrl: this.kind === 'video' ? PLACEHOLDER_VIDEO : PLACEHOLDER_IMAGE,
    };
  }
}
