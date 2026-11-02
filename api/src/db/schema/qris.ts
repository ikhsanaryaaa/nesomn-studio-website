import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { orders } from './orders.ts';
import { users } from './auth.ts';
export const qrisInvoices = pgTable(
  'qris_invoices',
  {
    orderId: uuid('order_id')
      .primaryKey()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    merchantId: text('merchant_id').notNull(),
    storeId: text('store_id').notNull(),
    requestKey: text('request_key').notNull(),
    requestHash: text('request_hash').notNull(),
    baseIdr: integer('base_idr').notNull(),
    code: integer('code').notNull(),
    payableIdr: integer('payable_idr').notNull(),
    quote: jsonb('quote').$type<{ subtotalIdr: number; discountIdr: number }>().notNull(),
    qrPayload: text('qr_payload').notNull(),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('qris_amount_never_reuse').on(t.merchantId, t.storeId, t.payableIdr),
    uniqueIndex('qris_checkout_request').on(t.userId, t.requestKey),
  ],
);
export const qrisReceipts = pgTable(
  'qris_receipts',
  {
    merchantId: text('merchant_id').notNull(),
    storeId: text('store_id').notNull(),
    reference: text('reference').notNull(),
    fingerprint: text('fingerprint').notNull(),
    amountIdr: integer('amount_idr').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    outcome: text('outcome').notNull().default('received'),
    orderId: uuid('order_id').references(() => orders.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.merchantId, t.storeId, t.reference] })],
);

export const qrisReservations = pgTable(
  'qris_reservations',
  {
    merchantId: text('merchant_id').notNull(),
    storeId: text('store_id').notNull(),
    amountIdr: integer('amount_idr').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.merchantId, t.storeId, t.amountIdr] })],
);
