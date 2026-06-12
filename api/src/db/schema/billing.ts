import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth.ts';

export const planSegment = pgEnum('plan_segment', ['individual', 'team', 'enterprise']);
export const billingCycle = pgEnum('billing_cycle', ['monthly', 'yearly']);
export const subscriptionStatus = pgEnum('subscription_status', [
  'active',
  'canceled',
  'expired',
  'pending',
]);
export const creditReason = pgEnum('credit_reason', [
  'subscription_grant',
  'topup',
  'usage',
  'refund',
  'admin_adjust',
]);

/** Hak akses editor per plan. */
export type EditorAccess = {
  scene2d: boolean;
  editor3d: boolean;
  proTemplates: boolean;
  aiVideo: boolean;
};

/**
 * Definisi paket langganan (PRD §10.1).
 * maxConcurrentSessions null = unlimited (Enterprise).
 */
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  segment: planSegment('segment').notNull(),
  cycle: billingCycle('cycle').notNull(),
  priceIdr: numeric('price_idr', { precision: 12, scale: 2 }).notNull().default('0'),
  priceUsd: numeric('price_usd', { precision: 12, scale: 2 }).notNull().default('0'),
  creditQuota: integer('credit_quota').notNull().default(0),
  maxConcurrentSessions: integer('max_concurrent_sessions'),
  editorAccess: jsonb('editor_access').$type<EditorAccess>().notNull(),
  commercial: boolean('commercial').notNull().default(false),
  isEnterprise: boolean('is_enterprise').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Langganan aktif/historis milik user. */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    status: subscriptionStatus('status').notNull().default('pending'),
    cycle: billingCycle('cycle').notNull(),
    segment: planSegment('segment').notNull(),
    gateway: text('gateway'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('subscriptions_user_id_idx').on(table.userId)],
);

/** Pack top-up credit (PRD §10.4), dikelola admin. */
export const creditPacks = pgTable('credit_packs', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  credits: integer('credits').notNull(),
  priceIdr: numeric('price_idr', { precision: 12, scale: 2 }).notNull(),
  priceUsd: numeric('price_usd', { precision: 12, scale: 2 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Riwayat credit berbasis ledger (PRD §10.3). Saldo = agregasi delta. */
export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    delta: integer('delta').notNull(),
    reason: creditReason('reason').notNull(),
    refType: text('ref_type'),
    refId: text('ref_id'),
    balanceAfter: integer('balance_after').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('credit_ledger_user_id_idx').on(table.userId)],
);
