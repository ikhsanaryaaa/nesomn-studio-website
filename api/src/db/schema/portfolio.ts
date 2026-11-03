import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  date,
  timestamp,
  index,
  unique,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { media } from './media.ts';

/** Separate allowlist: portfolio cannot publish private marketplace product files. */
export const portfolioUploads = pgTable('portfolio_uploads', {
  mediaId: uuid('media_id')
    .primaryKey()
    .references(() => media.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
});
export const portfolioWorks = pgTable(
  'portfolio_works',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    projectDate: date('project_date', { mode: 'string' }),
    client: text('client'),
    status: text('status').$type<'draft' | 'published'>().notNull().default('draft'),
    isSample: boolean('is_sample').notNull().default(false),
    coverMediaId: uuid('cover_media_id').references(() => portfolioUploads.mediaId, {
      onDelete: 'restrict',
    }),
    linkLabel: text('link_label'),
    linkUrl: text('link_url'),
    revision: integer('revision').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('portfolio_works_public_idx').on(t.status, t.projectDate, t.createdAt),
    check('portfolio_status_check', sql`${t.status} in ('draft', 'published')`),
    check('portfolio_revision_check', sql`${t.revision} > 0`),
    check('portfolio_link_pair_check', sql`(${t.linkLabel} is null) = (${t.linkUrl} is null)`),
    check(
      'portfolio_published_check',
      sql`${t.status} <> 'published' or (${t.coverMediaId} is not null and ${t.projectDate} is not null and length(trim(${t.description})) > 0)`,
    ),
  ],
);
export const portfolioGallery = pgTable(
  'portfolio_gallery',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workId: uuid('work_id')
      .notNull()
      .references(() => portfolioWorks.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => portfolioUploads.mediaId, { onDelete: 'restrict' }),
    posterMediaId: uuid('poster_media_id').references(() => portfolioUploads.mediaId, {
      onDelete: 'restrict',
    }),
    alt: text('alt').notNull().default(''),
    position: integer('position').notNull(),
  },
  (t) => [
    unique('portfolio_gallery_position_unique').on(t.workId, t.position),
    check('portfolio_gallery_position_check', sql`${t.position} >= 0`),
  ],
);
