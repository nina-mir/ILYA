import { Hono } from 'hono';

export const meRoutes = new Hono();

meRoutes.get('/', async (c) => {
  const user = c.get('user');
  return c.json({ user });
});
