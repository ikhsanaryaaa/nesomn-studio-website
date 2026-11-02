import type { AiJobInput, AiKind, AiTab } from '@nesomn/shared';
import { assertProviderUrl } from '../../lib/outbound.ts';
import { AppError } from '../../middleware/error.ts';
import { assertStubAllowed } from '../../lib/demo-policy.ts';

/**
 * Kontrak adapter provider AI. Setiap provider (stub/kie/vendor lain)
 * mengimplementasikan kontrak ini. Orchestrator memanggil generate()
 * tanpa tahu detail vendor. apiKey tidak pernah keluar dari server.
 */

export type GenerateResult = {
  /** URL hasil (image/video). Untuk stub bisa URL contoh atau data URL. */
  resultUrl: string;
};

export class ProviderFailure extends Error {
  constructor(
    public readonly confirmed: boolean,
    public readonly remoteRef?: string,
  ) {
    super(confirmed ? 'Provider confirmed failure.' : 'Provider execution is unconfirmed.');
  }
}
export type GenerateContext = { onAccepted: (remoteRef: string) => Promise<void> };
export interface AIProvider {
  readonly kind: AiKind;
  readonly tab: AiTab;
  generate(input: AiJobInput, context?: GenerateContext): Promise<GenerateResult>;
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

/** Registry credentials select the legacy adapter only with explicit production opt-in and allowed hosts.
 * Missing configuration fails closed; named samples require explicit nonproduction flags. */
export async function resolveProvider(row: ProviderRow): Promise<AIProvider> {
  if (row.baseUrl && row.apiKeyEncrypted) {
    if (process.env.NODE_ENV === 'production' && process.env.AI_LEGACY_ADAPTER_ENABLED !== 'true') {
      throw new AppError(
        'PROVIDER_UNVERIFIED',
        'The legacy provider adapter has not been verified or enabled.',
        503,
      );
    }
    assertProviderUrl(row.baseUrl);
    const { KieProvider } = await import('./providers/kie.ts');
    return new KieProvider(row);
  }
  assertStubAllowed('ai');
  if (!/^(?:stub|sample|demo)-/.test(row.key))
    throw new AppError(
      'PROVIDER_NOT_CONFIGURED',
      'The provider is not configured. No simulated fallback is available.',
      503,
    );
  const { StubProvider } = await import('./providers/stub.ts');
  return new StubProvider(row);
}
