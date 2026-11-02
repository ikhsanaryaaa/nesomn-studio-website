import type { PaymentProvider, CreateCheckoutResult, WebhookResult } from '../gateway.ts';
import { AppError } from '../../../middleware/error.ts';

/** No verified legacy Pakasir transport contract exists in this repository. */
export class PakasirGateway implements PaymentProvider {
  readonly name = 'pakasir' as const;
  async createCheckout(): Promise<CreateCheckoutResult> {
    throw new AppError(
      'LEGACY_PAYMENT_DISABLED',
      'Pakasir checkout has not been verified. No fallback is available.',
      503,
    );
  }
  async verifyWebhook(): Promise<WebhookResult> {
    throw new AppError(
      'LEGACY_PAYMENT_DISABLED',
      'Pakasir callbacks require verified reconciliation. Callback payloads alone cannot mark an order as paid.',
      503,
    );
  }
}
