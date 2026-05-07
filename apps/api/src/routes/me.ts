import { Hono } from 'hono';
import type { PublicUser } from '../types';

type AppEnv = {
  Variables: {
    user: PublicUser | null;
  };
};

export const meRoutes = new Hono<AppEnv>();

meRoutes.get('/me', (c) => {
  const user = c.get('user');
  return c.json({ user });
});
