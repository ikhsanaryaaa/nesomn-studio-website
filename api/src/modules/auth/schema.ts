import { z } from 'zod';

/** Skema validasi input untuk endpoint auth. */

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .email('Email tidak valid.')
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'Password minimal 8 karakter.').max(1024),
  name: z.string().min(1, 'Nama wajib diisi.').max(120),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .email('Email tidak valid.')
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Password wajib diisi.').max(1024),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
