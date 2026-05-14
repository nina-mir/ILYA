import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  API_PORT: z.coerce.number().int().positive().default(3000),

  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),

  AUTH_COOKIE_NAME: z.string().min(1).default('ilya_session'),

  AUTH_SESSION_DAYS: z.coerce.number().int().positive().default(30),

  AUTH_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(10),

  AUTH_CODE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  AUTH_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(30),

  AUTH_SECRET: z.string().min(32),

  EMAIL_MODE: z.enum(['console', 'resend']).default('console'),

  AUTH_FROM_EMAIL: z
    .string()
    .min(1)
    .default('Ilya <login@example.local>'),

  RESEND_API_KEY: z.string().optional(),

  // ---------------------------------------------------------------------------
  // Gutenberg import worker
  // ---------------------------------------------------------------------------

  GUTENBERG_USER_AGENT: z
    .string()
    .min(1)
    .default('IlyaLocalDev/0.1 (contact: local-dev@example.com)'),

  GUTENBERG_FETCH_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30000),

  GUTENBERG_MAX_TEXT_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10_000_000),

  IMPORT_WORKER_ID: z
    .string()
    .min(1)
    .default('local-worker-1'),

  IMPORT_WORKER_POLL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(2000),

  IMPORT_MAX_ATTEMPTS: z.coerce
    .number()
    .int()
    .positive()
    .default(3),
});

export const env = envSchema.parse(process.env);
