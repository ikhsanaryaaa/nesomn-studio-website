import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './auth.ts';

/** Upload generik (gambar/file) milik user atau sistem. */
export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  key: text('key').notNull().unique(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  width: integer('width'),
  height: integer('height'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
