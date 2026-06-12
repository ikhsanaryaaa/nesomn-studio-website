import { pgTable, pgEnum, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';

/** Peran user: admin atau user biasa. */
export const userRole = pgEnum('user_role', ['admin', 'user']);

/** Akun pengguna. passwordHash null untuk akun OAuth-only. */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    name: text('name').notNull(),
    role: userRole('role').notNull().default('user'),
    avatarUrl: text('avatar_url'),
    googleId: text('google_id').unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('users_email_idx').on(table.email)],
);

/** Sesi login aktif. Dibatasi plan.maxConcurrentSessions. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);
