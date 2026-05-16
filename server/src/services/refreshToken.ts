import crypto from 'node:crypto';
import { query, queryOne } from '../db/database.js';

const REFRESH_TTL_DAYS = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '7', 10);

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function issueRefreshToken(
  userId: string,
  meta: { userAgent?: string; ip?: string } = {}
): Promise<string> {
  const raw = crypto.randomBytes(48).toString('base64url');
  const hash = hashToken(raw);
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, hash, expires, meta.userAgent?.slice(0, 500) || null, meta.ip || null]
  );
  return raw;
}

export interface RefreshRecord {
  id: string;
  user_id: string;
  expires_at: string;
  revogado: boolean;
}

export async function consumeRefreshToken(raw: string): Promise<RefreshRecord | null> {
  if (!raw || raw.length < 32) return null;
  const hash = hashToken(raw);
  const rec = await queryOne<RefreshRecord>(
    `SELECT id, user_id, expires_at, revogado FROM refresh_tokens
     WHERE token_hash = $1 AND revogado = false`,
    [hash]
  );
  if (!rec) return null;
  if (new Date(rec.expires_at) < new Date()) return null;
  // Rotation: revoke immediately
  await query(
    'UPDATE refresh_tokens SET revogado = true, usado_em = NOW() WHERE id = $1',
    [rec.id]
  );
  return rec;
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await query(
    'UPDATE refresh_tokens SET revogado = true WHERE user_id = $1 AND revogado = false',
    [userId]
  );
}
