import type { Gateway } from '@nesomn/shared';

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
  orderId: string;
  status: 'paid' | 'failed';
  gatewayRef: string;
};

export interface PaymentProvider {
  readonly name: Gateway;
  createCheckout(order: CheckoutOrder): Promise<CreateCheckoutResult>;
  /**
   * Verifikasi keaslian webhook (signature/secret) dan ekstrak hasil.
   * Melempar bila signature tidak valid. rawBody = body mentah string.
   */
  verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookResult>;
}

/**
 * Pilih adapter gateway. Bila env gateway terisi, pakai gateway nyata;
 * selain itu fallback ke StubGateway (dev). Import dinamis agar adapter
 * berat tidak dimuat bila tak dipakai.
 */
export async function resolveGateway(name: Gateway): Promise<PaymentProvider> {
  if (name === 'pakasir' && process.env.PAKASIR_API_KEY) {
    const { PakasirGateway } = await import('./gateways/pakasir.ts');
    return new PakasirGateway();
  }
  if (name === 'stripe' && process.env.STRIPE_SECRET_KEY) {
    const { StripeGateway } = await import('./gateways/stripe.ts');
    return new StripeGateway();
  }
  const { StubGateway } = await import('./gateways/stub.ts');
  return new StubGateway();
}
