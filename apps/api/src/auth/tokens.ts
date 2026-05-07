import crypto from 'node:crypto';

export function createSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createLoginCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashLoginCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}
