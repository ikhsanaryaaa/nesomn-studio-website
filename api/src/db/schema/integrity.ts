import { pgTable, uuid, text, integer, timestamp, primaryKey, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth.ts';
import { orders } from './orders.ts';
import { aiJobs } from './ai.ts';

export const creditAccounts = pgTable('credit_accounts', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
});
export const creditLots = pgTable('credit_lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sourceKey: text('source_key').notNull().unique(),
  initial: integer('initial').notNull(),
  remaining: integer('remaining').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});
export const creditAllocations = pgTable(
  'credit_allocations',
  {
    operationKey: text('operation_key').notNull(),
    lotId: uuid('lot_id')
      .notNull()
      .references(() => creditLots.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
  },
  (t) => [primaryKey({ columns: [t.operationKey, t.lotId] })],
);
export const orderFulfillments = pgTable('order_fulfillments', {
  orderId: uuid('order_id')
    .primaryKey()
    .references(() => orders.id, { onDelete: 'cascade' }),
  state: text('state').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const paymentEvents = pgTable(
  'payment_events',
  {
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    receipt: jsonb('receipt').notNull(),
    fingerprint: text('fingerprint').notNull(),
    outcome: text('outcome').notNull().default('received'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.eventId] })],
);
export const aiOutbox = pgTable('ai_outbox', {
  jobId: uuid('job_id')
    .primaryKey()
    .references(() => aiJobs.id, { onDelete: 'cascade' }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  error: text('error'),
});
export const oauthStates = pgTable('oauth_states', {
  stateHash: text('state_hash').primaryKey(),
  cookieHash: text('cookie_hash').notNull(),
  verifierEncrypted: text('verifier_encrypted').notNull(),
  nonce: text('nonce').notNull(),
  returnPath: text('return_path').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const paymentReceipts = pgTable(
  'payment_receipts',
  {
    provider: text('provider').notNull(),
    gatewayRef: text('gateway_ref').notNull(),
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.provider, t.gatewayRef] })],
);
