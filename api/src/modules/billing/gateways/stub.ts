import type {
  PaymentProvider,
  CheckoutOrder,
  CreateCheckoutResult,
  WebhookResult,
} from '../gateway.ts';
import { assertStubAllowed } from '../../../lib/demo-policy.ts';

/**
 * Gateway stub untuk dev: tidak memanggil layanan eksternal. Checkout
 * mengarahkan ke halaman simulasi internal; pembayaran dipicu lewat
 * endpoint dev (/billing/dev/pay/:orderId) yang memanggil grant.
 * Unsigned webhook selalu ditolak; simulasi hanya lewat endpoint demo yang dibatasi.
 */
export class StubGateway implements PaymentProvider {
  readonly name = 'stub' as const;

  async createCheckout(order: CheckoutOrder): Promise<CreateCheckoutResult> {
    assertStubAllowed('payment');
    // URL simulasi di client; gatewayRef cukup penanda lokal unik.
    return {
      checkoutUrl: `/checkout?order=${order.id}`,
      gatewayRef: `stub_${order.id}`,
    };
  }

  async verifyWebhook(): Promise<WebhookResult> {
    throw new Error('Unsigned stub webhook is not a payment confirmation.');
  }
}
