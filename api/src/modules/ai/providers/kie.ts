import type { AiJobInput } from '@nesomn/shared';
import type { AIProvider, GenerateResult, ProviderRow } from '../provider.ts';
import { decryptSecret } from '../../../lib/crypto.ts';

/**
 * Provider produksi untuk gateway kie.ai (1 API key, banyak model).
 * Kerangka alur: submit job -> poll status -> ambil hasil. Diaktifkan
 * saat registry mengisi baseUrl + apiKey. apiKey didekripsi server-side
 * dan tidak pernah keluar dari server.
 *
 * Catatan RK-1: untuk video, model harus mendukung start+end keyframe +
 * camera control. Bila tidak, terapkan fallback (start frame saja +
 * gerak kamera sintetis dari trajectory). Validasi model nyata menunggu
 * ketersediaan API key (lihat issue M7 Notes).
 */

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class KieProvider implements AIProvider {
  readonly kind: ProviderRow['kind'];
  readonly tab: ProviderRow['tab'];
  private readonly baseUrl: string;
  private readonly modelName: string;
  private readonly apiKey: string;

  constructor(row: ProviderRow) {
    if (!row.baseUrl) throw new Error('KieProvider butuh baseUrl.');
    if (!row.apiKeyEncrypted) throw new Error('KieProvider butuh apiKey.');
    this.kind = row.kind;
    this.tab = row.tab;
    this.baseUrl = row.baseUrl.replace(/\/$/, '');
    this.modelName = row.modelName;
    this.apiKey = decryptSecret(row.apiKeyEncrypted);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /** Terjemahkan input internal ke payload kie.ai (disesuaikan saat integrasi nyata). */
  private buildPayload(input: AiJobInput): Record<string, unknown> {
    return { model: this.modelName, kind: this.kind, input };
  }

  async generate(input: AiJobInput): Promise<GenerateResult> {
    // 1. Submit job.
    const submitRes = await fetch(`${this.baseUrl}/jobs`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildPayload(input)),
      signal: AbortSignal.timeout(15_000),
    });
    if (!submitRes.ok) {
      throw new Error(`Submit gagal: HTTP ${submitRes.status}`);
    }
    const submit = (await submitRes.json()) as { id?: string };
    const remoteId = submit.id;
    if (!remoteId) throw new Error('Respons submit tidak memuat id job.');

    // 2. Poll status sampai selesai atau timeout.
    const startedAt = Date.now();
    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      await delay(POLL_INTERVAL_MS);
      const pollRes = await fetch(`${this.baseUrl}/jobs/${remoteId}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(15_000),
      });
      if (!pollRes.ok) continue;
      const poll = (await pollRes.json()) as {
        status?: string;
        resultUrl?: string;
        error?: string;
      };
      if (poll.status === 'done' && poll.resultUrl) {
        return { resultUrl: poll.resultUrl };
      }
      if (poll.status === 'failed') {
        throw new Error(poll.error || 'Provider melaporkan job gagal.');
      }
    }
    throw new Error('Timeout menunggu hasil provider.');
  }
}
