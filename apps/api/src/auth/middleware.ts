import type { Context, Next } from 'hono';
import { getSessionCookie } from './cookies';
import { getUserBySessionToken, type PublicUser } from './service';

export type AuthVariables = {
  user: PublicUser | null;
};

export async function attachUser(c: Context, next: Next) {
  const token = getSessionCookie(c);
  const user = await getUserBySessionToken(token);
  c.set('user', user);
  await next();
}

export async function requireUser(c: Context, next: Next) {
  const user = c.get('user') as PublicUser | null;
  if (!user) {
    return c.json({ error: 'You must be signed in.' }, 401);
  }
  await next();
}
