import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth.ts';

export const aiKind = pgEnum('ai_kind', ['image', 'video']);
export const aiTab = pgEnum('ai_tab', ['scene', 'motion']);
export const aiJobStatus = pgEnum('ai_job_status', ['pending', 'processing', 'done', 'failed']);

/**
 * Registry provider AI (PRD §9). apiKey disimpan terenkripsi.
 * creditCost diatur admin via menu Usage (PRD §10.5).
 */
export const aiProviders = pgTable('ai_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  kind: aiKind('kind').notNull(),
  modelName: text('model_name').notNull(),
  apiKeyEncrypted: text('api_key_encrypted'),
  baseUrl: text('base_url'),
  enabled: boolean('enabled').notNull().default(true),
  creditCost: integer('credit_cost').notNull().default(0),
  tab: aiTab('tab').notNull(),
  tierAccess: jsonb('tier_access').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Antrian job AI (PRD §9.5). 1 job aktif/user, priority Pro > Free. */
export const aiJobs = pgTable(
  'ai_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: uuid('provider_id')
      .notNull()
      .references(() => aiProviders.id),
    kind: aiKind('kind').notNull(),
    status: aiJobStatus('status').notNull().default('pending'),
    priority: integer('priority').notNull().default(0),
    input: jsonb('input').notNull().default({}),
    creditCost: integer('credit_cost').notNull().default(0),
    resultUrl: text('result_url'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_jobs_user_id_idx').on(table.userId),
    index('ai_jobs_status_idx').on(table.status),
  ],
);
