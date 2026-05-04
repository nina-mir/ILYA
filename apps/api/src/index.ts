import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const PORT = Number(process.env.PORT ?? 3000);

app.use('*', logger());

app.use(
  '*',
  cors({
    origin: WEB_ORIGIN,
    credentials: true,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/health', (c) => {
  return c.json({
    ok: true,
    service: 'ilya-api',
    phase: 1,
    time: new Date().toISOString(),
  });
});

app.get('/api/health', (c) => {
  return c.json({
    ok: true,
    service: 'ilya-api',
    phase: 1,
    time: new Date().toISOString(),
  });
});

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`Ilya API listening on http://localhost:${info.port}`);
    console.log(`Allowed web origin: ${WEB_ORIGIN}`);
  },
);
