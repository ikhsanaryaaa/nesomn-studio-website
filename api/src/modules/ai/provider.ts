import type { AiJobInput, AiKind, AiTab } from '@nesomn/shared';

/**
 * Kontrak adapter provider AI. Setiap provider (stub/kie/vendor lain)
 * mengimplementasikan kontrak ini. Orchestrator memanggil generate()
 * tanpa tahu detail vendor. apiKey tidak pernah keluar dari server.
 */

export type GenerateResult = {
  /** URL hasil (image/video). Untuk stub bisa URL contoh atau data URL. */
  resultUrl: string;
};

export interface AIProvider {
  readonly kind: AiKind;
  readonly tab: AiTab;
  generate(input: AiJobInput): Promise<GenerateResult>;
}

/** Baris registry yang relevan untuk memilih adapter. */
export type ProviderRow = {
  key: string;
  kind: AiKind;
  tab: AiTab;
  modelName: string;
  baseUrl: string | null;
  apiKeyEncrypted: string | null;
};

/**
 * Pilih adapter dari baris registry. Bila baseUrl + apiKey terisi,
 * pakai KieProvider (produksi). Selain itu pakai StubProvider (dev).
 * Import adapter dilakukan dinamis agar StubProvider tidak menyeret
 * dependensi crypto bila tak diperlukan.
 */
export async function resolveProvider(row: ProviderRow): Promise<AIProvider> {
  if (row.baseUrl && row.apiKeyEncrypted) {
    const { KieProvider } = await import('./providers/kie.ts');
    return new KieProvider(row);
  }
  const { StubProvider } = await import('./providers/stub.ts');
  return new StubProvider(row);
}
