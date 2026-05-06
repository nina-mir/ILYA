import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { env } from '../env';

export function getSessionCookie(c: Context): string | undefined {
  return getCookie(c, env.AUTH_COOKIE_NAME);
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date): void {
  setCookie(c, env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, env.AUTH_COOKIE_NAME, {
    path: '/',
  });
}
