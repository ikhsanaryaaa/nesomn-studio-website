import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  numeric,
  timestamp,
  jsonb,
  primaryKey,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';

/** Tipe kolom tsvector Postgres untuk full-text search. */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const assetType = pgEnum('asset_type', [
  'font',
  'mockup3d',
  'mockup2d',
  'asset3d',
  'graphic',
  'motion',
]);
export const assetTier = pgEnum('asset_tier', ['free', 'pro']);
export const bundleType = pgEnum('bundle_type', ['preset', 'custom']);

/** Editor tujuan aset: menentukan domain akses (subscription 3D vs Scene). */
export const editorType = pgEnum('editor_type', ['scene_editor', 'product_3d_editor']);

/** Status publikasi aset. `draft` disembunyikan dari katalog publik. */
export const assetStatus = pgEnum('asset_status', ['draft', 'published', 'archived']);

/** Item marketplace (PRD §8.1). */
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    type: assetType('type').notNull(),
    tier: assetTier('tier').notNull().default('free'),
    // Domain akses aset (menentukan subscription mana yang boleh memakainya).
    editorType: editorType('editor_type').notNull().default('scene_editor'),
    // Kategori bebas untuk pengelompokan Library (mis. 'mockup', 'font').
    category: text('category'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    version: text('version').notNull().default('1.0.0'),
    status: assetStatus('status').notNull().default('draft'),
    // Kepemilikan: bisa dibeli di marketplace dan/atau termasuk aset subscription.
    isMarketplace: boolean('is_marketplace').notNull().default(false),
    isSubscriptionAsset: boolean('is_subscription_asset').notNull().default(true),
    thumbnail: text('thumbnail'),
    priceIdr: numeric('price_idr', { precision: 12, scale: 2 }).notNull().default('0'),
    priceUsd: numeric('price_usd', { precision: 12, scale: 2 }).notNull().default('0'),
    previews: jsonb('previews').$type<string[]>().notNull().default([]),
    fileKey: text('file_key'),
    glbFile: text('glb_file'),
    uvMapInfo: jsonb('uv_map_info'),
    popular: boolean('popular').notNull().default(false),
    // Full-text search: gabungan title + description, di-maintain Postgres.
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('simple', ${assets.title} || ' ' || coalesce(${assets.description}, ''))`,
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('assets_search_idx').using('gin', table.searchVector)],
);

/** Koleksi tematik/preset (PRD §8.3). */
export const bundles = pgTable('bundles', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  type: bundleType('type').notNull().default('preset'),
  previews: jsonb('previews').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Relasi many-to-many bundle <-> assets. */
export const bundleItems = pgTable(
  'bundle_items',
  {
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => bundles.id, { onDelete: 'cascade' }),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.bundleId, table.assetId] })],
);
