import { Hono } from 'hono';
import { z } from 'zod';
import { clearSessionCookie, getSessionCookie, setSessionCookie } from '../auth/cookies';
import { logoutSession, sendLoginCode, verifyLoginCode } from '../auth/service';

export const authRoutes = new Hono();

const sendCodeSchema = z.object({
  email: z.string().min(1),
});

const verifyCodeSchema = z.object({
  email: z.string().min(1),
  code: z.string().min(1),
});

authRoutes.post('/send-code', async (c) => {
  try {
    const body = sendCodeSchema.parse(await c.req.json());
    await sendLoginCode(body.email);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not send a code.';
    return c.json({ error: message }, 400);
  }
});

authRoutes.post('/verify-code', async (c) => {
  try {
    const body = verifyCodeSchema.parse(await c.req.json());
    const result = await verifyLoginCode(body);
    setSessionCookie(c, result.sessionToken, result.sessionExpiresAt);
    return c.json({ user: result.user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not verify that code.';
    return c.json({ error: message }, 400);
  }
});

authRoutes.post('/logout', async (c) => {
  const token = getSessionCookie(c);
  await logoutSession(token);
  clearSessionCookie(c);
  return c.json({ ok: true });
});
