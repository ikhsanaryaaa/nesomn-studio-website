import type {
  PaymentProvider,
  CheckoutOrder,
  CreateCheckoutResult,
  WebhookResult,
} from '../gateway.ts';

/**
 * Gateway Stripe (global). Kerangka produksi: membuat Checkout Session
 * dan memverifikasi signature webhook (Stripe-Signature). Aktif saat
 * STRIPE_SECRET_KEY terisi. Pemanggilan API & verifikasi signature
 * disesuaikan saat integrasi nyata (idealnya pakai SDK stripe).
 * Secret hanya dari env.
 */
export class StripeGateway implements PaymentProvider {
  readonly name = 'stripe' as const;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY ?? '';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    if (!this.secretKey) throw new Error('STRIPE_SECRET_KEY belum diset.');
  }

  async createCheckout(order: CheckoutOrder): Promise<CreateCheckoutResult> {
    // Stripe Checkout Session via REST (form-encoded). USD dalam sen.
    const body = new URLSearchParams({
      mode: 'payment',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': order.description,
      'line_items[0][price_data][unit_amount]': String(Math.round(order.amountUsd * 100)),
      'line_items[0][quantity]': '1',
      client_reference_id: order.id,
      success_url: `${process.env.CLIENT_URL ?? 'http://localhost'}/account?paid=${order.id}`,
      cancel_url: `${process.env.CLIENT_URL ?? 'http://localhost'}/checkout?order=${order.id}`,
    });
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Stripe checkout gagal: HTTP ${res.status}`);
    const data = (await res.json()) as { id?: string; url?: string };
    if (!data.url || !data.id) throw new Error('Respons Stripe tidak lengkap.');
    return { checkoutUrl: data.url, gatewayRef: data.id };
  }

  async verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
    if (!signature) throw new Error('Header Stripe-Signature hilang.');
    // Verifikasi penuh idealnya memakai stripe.webhooks.constructEvent.
    // Di sini kerangka: pastikan secret ada lalu parse event.
    if (!this.webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET belum diset.');
    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: { object?: { client_reference_id?: string; id?: string } };
    };
    const obj = event.data?.object;
    if (!obj?.client_reference_id) throw new Error('Webhook Stripe tanpa client_reference_id.');
    return {
      orderId: obj.client_reference_id,
      status: event.type === 'checkout.session.completed' ? 'paid' : 'failed',
      gatewayRef: obj.id ?? obj.client_reference_id,
    };
  }
}
