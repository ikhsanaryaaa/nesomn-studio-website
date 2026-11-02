import { z } from 'zod';

/** Skema validasi input untuk endpoint auth. */

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .email('Invalid email address.')
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'Password must contain at least 8 characters.').max(1024),
  name: z.string().min(1, 'Name is required.').max(120),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .email('Invalid email address.')
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Password is required.').max(1024),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
