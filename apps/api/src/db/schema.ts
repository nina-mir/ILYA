import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// -----------------------------------------------------------------------------
// Users
// -----------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    roles: text('roles')
      .array()
      .notNull()
      .default(sql`ARRAY['reader']::text[]`),
    displayName: text('display_name'),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    readingDays: text('reading_days')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex('users_email_unique').on(table.email),
  }),
);

// -----------------------------------------------------------------------------
// Email login codes
// -----------------------------------------------------------------------------

export const emailLoginCodes = pgTable(
  'email_login_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIdx: index('email_login_codes_email_idx').on(table.email),
    expiresAtIdx: index('email_login_codes_expires_at_idx').on(table.expiresAt),
  }),
);

// -----------------------------------------------------------------------------
// Sessions
// -----------------------------------------------------------------------------

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
  }),
);

// -----------------------------------------------------------------------------
// Cached Gutenberg books
// -----------------------------------------------------------------------------

export const cachedBooks = pgTable(
  'cached_books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gutenbergId: text('gutenberg_id').notNull(),
    title: text('title').notNull(),
    author: text('author').notNull().default(''),
    language: text('language').notNull().default('en'),
    rawText: text('raw_text').notNull(),
    cleanedMarkdown: text('cleaned_markdown').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    sourceUrl: text('source_url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    gutenbergIdUnique: uniqueIndex('cached_books_gutenberg_id_unique').on(
      table.gutenbergId,
    ),
  }),
);

// -----------------------------------------------------------------------------
// User books / personal editions
// -----------------------------------------------------------------------------

export const userBooks = pgTable(
  'user_books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gutenbergId: text('gutenberg_id').notNull(),
    title: text('title').notNull().default('An untitled edition'),
    author: text('author').notNull().default(''),
    markdownContent: text('markdown_content').notNull().default(''),
    status: text('status').notNull().default('pending'),
    statusMessage: text('status_message'),
    lastEditedAt: timestamp('last_edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userBookUnique: uniqueIndex('user_books_user_id_gutenberg_id_unique').on(
      table.userId,
      table.gutenbergId,
    ),
    userIdIdx: index('user_books_user_id_idx').on(table.userId),
    gutenbergIdIdx: index('user_books_gutenberg_id_idx').on(table.gutenbergId),
    statusIdx: index('user_books_status_idx').on(table.status),
  }),
);

// -----------------------------------------------------------------------------
// Import jobs
// -----------------------------------------------------------------------------

export const importJobs = pgTable(
  'import_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userBookId: uuid('user_book_id')
      .notNull()
      .references(() => userBooks.id, { onDelete: 'cascade' }),
    gutenbergId: text('gutenberg_id').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusIdx: index('import_jobs_status_idx').on(table.status),
    gutenbergIdIdx: index('import_jobs_gutenberg_id_idx').on(table.gutenbergId),
    userBookIdIdx: index('import_jobs_user_book_id_idx').on(table.userBookId),
  }),
);

// -----------------------------------------------------------------------------
// Optional type exports for later phases
// -----------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type EmailLoginCode = typeof emailLoginCodes.$inferSelect;
export type NewEmailLoginCode = typeof emailLoginCodes.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type CachedBook = typeof cachedBooks.$inferSelect;
export type NewCachedBook = typeof cachedBooks.$inferInsert;

export type UserBook = typeof userBooks.$inferSelect;
export type NewUserBook = typeof userBooks.$inferInsert;

export type ImportJob = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;