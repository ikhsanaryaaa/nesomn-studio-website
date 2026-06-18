import type {
  PaymentProvider,
  CheckoutOrder,
  CreateCheckoutResult,
  WebhookResult,
} from '../gateway.ts';

/**
 * Gateway stub untuk dev: tidak memanggil layanan eksternal. Checkout
 * mengarahkan ke halaman simulasi internal; pembayaran dipicu lewat
 * endpoint dev (/billing/dev/pay/:orderId) yang memanggil grant.
 * verifyWebhook menerima payload internal apa adanya (tanpa signature).
 */
export class StubGateway implements PaymentProvider {
  readonly name = 'stub' as const;

  async createCheckout(order: CheckoutOrder): Promise<CreateCheckoutResult> {
    // URL simulasi di client; gatewayRef cukup penanda lokal unik.
    return {
      checkoutUrl: `/checkout?order=${order.id}`,
      gatewayRef: `stub_${order.id}`,
    };
  }

  async verifyWebhook(rawBody: string): Promise<WebhookResult> {
    // Payload internal dari endpoint dev: { orderId, status }.
    const data = JSON.parse(rawBody) as { orderId?: string; status?: 'paid' | 'failed' };
    if (!data.orderId) {
      throw new Error('Payload stub tidak valid: orderId hilang.');
    }
    return {
      orderId: data.orderId,
      status: data.status ?? 'paid',
      gatewayRef: `stub_${data.orderId}`,
    };
  }
}
