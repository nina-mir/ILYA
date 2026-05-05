import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_COOKIE_NAME: z.string().default('ilya_session'),
  SESSION_SECRET: z.string().min(16).default('local-development-session-secret'),
  AUTH_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  AUTH_CODE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  EMAIL_MODE: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional().default(''),
  AUTH_FROM_EMAIL: z.string().default('Ilya <login@example.com>'),
});

export const env = envSchema.parse(process.env);
