import type { Gateway } from '@nesomn/shared';
import { AppError } from '../../middleware/error.ts';
import { assertStubAllowed } from '../../lib/demo-policy.ts';

/**
 * Kontrak adapter gateway pembayaran. Setiap gateway (stub/pakasir/stripe)
 * mengimplementasikan kontrak ini. Billing service memanggil tanpa tahu
 * detail vendor. Secret hanya di server (env), tidak pernah ke client.
 */

/** Order minimal yang dibutuhkan gateway untuk membuat checkout. */
export type CheckoutOrder = {
  id: string;
  amountIdr: number;
  amountUsd: number;
  currency: string;
  description: string;
};

/** Hasil pembuatan checkout dari gateway. */
export type CreateCheckoutResult = {
  /** URL redirect ke halaman pembayaran (atau simulasi untuk stub). */
  checkoutUrl: string;
  /** Referensi eksternal gateway (invoice/session id). */
  gatewayRef: string;
};

/** Hasil verifikasi webhook: order mana yang dibayar dan statusnya. */
export type WebhookResult = {
  eventId: string;
  orderId: string;
  status: 'paid' | 'failed';
  gatewayRef: string;
  amountMinor: number;
  currency: 'IDR' | 'USD';
};

export interface PaymentProvider {
  readonly name: Gateway;
  createCheckout(order: CheckoutOrder): Promise<CreateCheckoutResult>;
  /**
   * Verifikasi keaslian webhook (signature/secret) dan ekstrak hasil.
   * Melempar bila signature tidak valid. rawBody = body mentah string.
   */
  verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookResult | null>;
}

/** Verified legacy ingestion only; new legacy checkout is disabled. No implicit simulator fallback. */
export async function resolveGateway(
  name: Gateway,
  purpose: 'checkout' | 'webhook' = 'checkout',
): Promise<PaymentProvider> {
  if (name === 'stripe' && purpose === 'webhook' && process.env.STRIPE_WEBHOOK_SECRET) {
    const { StripeGateway } = await import('./gateways/stripe.ts');
    return new StripeGateway();
  }
  if (name === 'stub') {
    assertStubAllowed('payment');
    const { StubGateway } = await import('./gateways/stub.ts');
    return new StubGateway();
  }
  if (name !== 'stripe' && name !== 'pakasir')
    throw new AppError('UNKNOWN_GATEWAY', 'Gateway tidak dikenal.', 400);
  throw new AppError(
    'LEGACY_PAYMENT_DISABLED',
    'Gateway legacy belum diaktifkan untuk transaksi baru/rekonsiliasi otomatis. Tidak ada fallback simulasi.',
    503,
  );
}
