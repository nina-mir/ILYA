import crypto from 'node:crypto';
import { env } from '../env';

export function generateSixDigitCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSecret(value: string): string {
  return crypto
    .createHmac('sha256', env.AUTH_SECRET)
    .update(value)
    .digest('hex');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}
