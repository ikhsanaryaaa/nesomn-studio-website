import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth.ts';
import { assets } from './catalog.ts';

export const orderType = pgEnum('order_type', ['asset', 'bundle', 'topup', 'subscription']);
export const orderStatus = pgEnum('order_status', ['pending', 'paid', 'failed', 'refunded']);

/** Pembelian aset/bundle/top-up/langganan (PRD §11). */
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: orderType('type').notNull(),
  status: orderStatus('status').notNull().default('pending'),
  amountIdr: numeric('amount_idr', { precision: 12, scale: 2 }).notNull().default('0'),
  amountUsd: numeric('amount_usd', { precision: 12, scale: 2 }).notNull().default('0'),
  currency: text('currency').notNull().default('IDR'),
  gateway: text('gateway'),
  gatewayRef: text('gateway_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Baris item dalam satu order. */
export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  refType: text('ref_type').notNull(),
  refId: text('ref_id').notNull(),
  qty: integer('qty').notNull().default(1),
  unitPriceIdr: numeric('unit_price_idr', { precision: 12, scale: 2 }).notNull().default('0'),
  unitPriceUsd: numeric('unit_price_usd', { precision: 12, scale: 2 }).notNull().default('0'),
});

/** Hak download user atas aset (own forever via signed URL R2). */
export const licenses = pgTable(
  'licenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id),
    orderId: uuid('order_id').references(() => orders.id),
    fileKey: text('file_key'),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('licenses_user_id_idx').on(table.userId)],
);
