import type { PaymentProvider, CreateCheckoutResult, WebhookResult } from '../gateway.ts';
import { AppError } from '../../../middleware/error.ts';

/** No verified legacy Pakasir transport contract exists in this repository. */
export class PakasirGateway implements PaymentProvider {
  readonly name = 'pakasir' as const;
  async createCheckout(): Promise<CreateCheckoutResult> {
    throw new AppError(
      'LEGACY_PAYMENT_DISABLED',
      'Checkout Pakasir belum diverifikasi; tidak ada fallback.',
      503,
    );
  }
  async verifyWebhook(): Promise<WebhookResult> {
    throw new AppError(
      'LEGACY_PAYMENT_DISABLED',
      'Callback Pakasir memerlukan rekonsiliasi terverifikasi; tidak menerima payload sebagai paid.',
      503,
    );
  }
}
