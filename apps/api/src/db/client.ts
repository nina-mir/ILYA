import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../env';
import * as schema from './schema';

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
});

export const db = drizzle(queryClient, { schema });
export { queryClient };
