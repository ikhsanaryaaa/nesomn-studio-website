import type {
  PaymentProvider,
  CheckoutOrder,
  CreateCheckoutResult,
  WebhookResult,
} from '../gateway.ts';

/**
 * Gateway Pakasir (Indonesia). Kerangka produksi: membuat invoice dan
 * memverifikasi webhook via secret. Aktif saat PAKASIR_API_KEY terisi.
 * Endpoint & payload disesuaikan saat integrasi nyata dengan dokumentasi
 * Pakasir. Secret hanya dari env (AI-RULES: tidak hardcode).
 */
export class PakasirGateway implements PaymentProvider {
  readonly name = 'pakasir' as const;
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.PAKASIR_API_KEY ?? '';
    this.webhookSecret = process.env.PAKASIR_WEBHOOK_SECRET ?? '';
    this.baseUrl = process.env.PAKASIR_BASE_URL ?? 'https://api.pakasir.com/v1';
    if (!this.apiKey) throw new Error('PAKASIR_API_KEY belum diset.');
  }

  async createCheckout(order: CheckoutOrder): Promise<CreateCheckoutResult> {
    const res = await fetch(`${this.baseUrl}/invoices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        external_id: order.id,
        amount: order.amountIdr,
        currency: 'IDR',
        description: order.description,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Pakasir checkout gagal: HTTP ${res.status}`);
    const data = (await res.json()) as { id?: string; invoice_url?: string };
    if (!data.invoice_url || !data.id) throw new Error('Respons Pakasir tidak lengkap.');
    return { checkoutUrl: data.invoice_url, gatewayRef: data.id };
  }

  async verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
    // Verifikasi HMAC dengan webhook secret (algoritma sesuai dok Pakasir).
    const expected = await hmacSha256(rawBody, this.webhookSecret);
    if (!signature || signature !== expected) {
      throw new Error('Signature webhook Pakasir tidak valid.');
    }
    const data = JSON.parse(rawBody) as {
      external_id?: string;
      status?: string;
      id?: string;
    };
    if (!data.external_id) throw new Error('Webhook Pakasir tanpa external_id.');
    return {
      orderId: data.external_id,
      status: data.status === 'PAID' ? 'paid' : 'failed',
      gatewayRef: data.id ?? data.external_id,
    };
  }
}

/** HMAC-SHA256 hex memakai Web Crypto (tersedia di Bun). */
async function hmacSha256(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
