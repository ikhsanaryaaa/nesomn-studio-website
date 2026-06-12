import { pgTable, pgEnum, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './auth.ts';

export const projectKind = pgEnum('project_kind', ['scene2d', 'scene3d']);

/** Karya user (state editor sebagai JSON). */
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: projectKind('kind').notNull(),
    state: jsonb('state').notNull().default({}),
    thumbnailKey: text('thumbnail_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('projects_user_id_idx').on(table.userId)],
);
