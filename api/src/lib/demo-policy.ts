import { AppError } from '../middleware/error.ts';

export function stubAllowed(kind: 'payment' | 'ai'): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env[kind === 'payment' ? 'ALLOW_PAYMENT_STUB' : 'ALLOW_AI_STUB'] === 'true'
  );
}

export function assertStubAllowed(kind: 'payment' | 'ai') {
  if (!stubAllowed(kind))
    throw new AppError(
      'DEMO_DISABLED',
      'Simulasi hanya tersedia pada environment demo/test yang diaktifkan secara eksplisit.',
      503,
    );
}
