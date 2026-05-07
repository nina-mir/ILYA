import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { env } from './env';
import { attachUser } from './auth/middleware';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { readersRoute } from './routes/readers';
import { editionsRoute } from './routes/editions';

//import type { PublicUser } from './types';

import type { PublicUser } from './auth/service';

type AppEnv = {
  Variables: {
    user: PublicUser | null;
  };
};

const app = new Hono<AppEnv>();

app.use(
  '*',
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);

app.use('*', attachUser);

app.get('/health', (c) => {
  return c.json({ ok: true, service: 'ilya-api' });
});

app.route('/api/auth', authRoutes);
app.route('/api', meRoutes);
app.route('/api', readersRoute);
app.route('/api', editionsRoute);


app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: 'The press has stopped.' }, 500);
});

serve({
  fetch: app.fetch,
  port: env.API_PORT,
});

console.log(`Ilya API running on http://localhost:${env.API_PORT}`);
