import { Elysia } from 'elysia';
import { ZodError } from 'zod';

/** Error aplikasi dengan kode & status HTTP terstruktur. */
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Error handler global: memetakan error ke respons terstruktur
 * { error: { code, message } } tanpa membocorkan stack trace.
 */
export const errorHandler = new Elysia({ name: 'error-handler' }).onError(
  { as: 'global' },
  ({ error, code, set }) => {
    if (error instanceof AppError) {
      set.status = error.status;
      return { error: { code: error.code, message: error.message } };
    }

    if (error instanceof ZodError) {
      set.status = 422;
      return {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input tidak valid.',
          fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { error: { code: 'NOT_FOUND', message: 'Resource tidak ditemukan.' } };
    }

    if (code === 'VALIDATION') {
      set.status = 422;
      return { error: { code: 'VALIDATION_ERROR', message: 'Input tidak valid.' } };
    }

    // Fallback: jangan bocorkan detail internal.
    set.status = 500;
    console.error('[error]', error);
    return { error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal.' } };
  },
);
