import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { PaymentProvider, CreateCheckoutResult, WebhookResult } from '../gateway.ts';
import { AppError } from '../../../middleware/error.ts';

/** Legacy history verifier only. New checkout is disabled until the QRIS cutover. */
export class StripeGateway implements PaymentProvider {
  readonly name = 'stripe' as const;

  async createCheckout(): Promise<CreateCheckoutResult> {
    throw new AppError('LEGACY_PAYMENT_DISABLED', 'Checkout Stripe baru tidak diaktifkan.', 503);
  }

  async verifyWebhook(rawBody: string, signature: string | null): Promise<WebhookResult | null> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature || signature.length > 4096 || rawBody.length > 1024 * 1024)
      throw new Error('Invalid webhook.');
    const fields = signature.split(',').map((field) => field.trim().split('='));
    const timestamps = fields.filter(([key]) => key === 't').map(([, value]) => value!);
    if (timestamps.length !== 1 || !/^\d+$/.test(timestamps[0]!))
      throw new Error('Invalid webhook timestamp.');
    const timestamp = Number(timestamps[0]);
    if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300)
      throw new Error('Webhook timestamp outside tolerance.');
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
    const valid = fields.some(
      ([key, value]) =>
        key === 'v1' &&
        /^[a-f0-9]{64}$/.test(value ?? '') &&
        timingSafeEqual(Buffer.from(value!, 'hex'), expected),
    );
    if (!valid) throw new Error('Invalid webhook signature.');
    const event = z
      .object({
        id: z.string().min(1).max(255),
        type: z.string(),
        data: z.object({ object: z.unknown() }),
      })
      .parse(JSON.parse(rawBody));
    if (
      !['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(
        event.type,
      )
    )
      return null;
    const checkout = z
      .object({
        id: z.string().min(1).max(255),
        mode: z.literal('payment'),
        client_reference_id: z.string().uuid(),
        payment_status: z.string(),
        amount_total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        currency: z.enum(['usd', 'idr']),
      })
      .parse(event.data.object);
    if (checkout.payment_status !== 'paid') return null;
    return {
      eventId: event.id,
      orderId: checkout.client_reference_id,
      status: 'paid',
      gatewayRef: checkout.id,
      amountMinor: checkout.amount_total,
      currency: checkout.currency === 'usd' ? 'USD' : 'IDR',
    };
  }
}
