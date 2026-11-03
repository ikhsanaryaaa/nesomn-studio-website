import { z } from 'zod';
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((value) => value || null);
const galleryItem = z
  .object({
    mediaId: z.string().uuid(),
    alt: z.string().trim().max(500).default(''),
    posterMediaId: z.string().uuid().nullable().default(null),
  })
  .strict();
export const workBody = z
  .object({
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,159}$/),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(20000).default(''),
    projectDate: z.iso.date().nullable().default(null),
    client: nullableText(160),
    status: z.enum(['draft', 'published']).default('draft'),
    isSample: z.boolean().default(false),
    coverMediaId: z.string().uuid().nullable().default(null),
    linkLabel: nullableText(80),
    linkUrl: z
      .string()
      .max(2048)
      .url()
      .refine((value) => {
        const url = new URL(value);
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
      }, 'Use an HTTP(S) URL without credentials.')
      .nullable()
      .default(null),
    gallery: z.array(galleryItem).max(40).default([]),
  })
  .strict();
export const workUpdateBody = workBody.extend({ expectedRevision: z.number().int().positive() });
export type WorkInput = z.infer<typeof workBody>;
export function validateWork(input: WorkInput) {
  if (!!input.linkLabel !== !!input.linkUrl)
    throw new Error('Provide both a custom link label and URL.');
  if (
    input.status === 'published' &&
    (!input.coverMediaId || !input.projectDate || !input.description)
  )
    throw new Error('Publishing requires a cover, project date and description.');
  if (new Set(input.gallery.map((item) => item.mediaId)).size !== input.gallery.length)
    throw new Error('Gallery media must not be repeated.');
}
