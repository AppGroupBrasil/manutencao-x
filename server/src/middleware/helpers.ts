import { query, queryOne } from '../db/database.js';
import { AuthRequest } from './auth.js';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

/** Check if login is rate-limited for this email/IP */
export async function checkRateLimit(email: string, ip: string): Promise<{ blocked: boolean; remaining: number }> {
  const cutoff = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM login_attempts
     WHERE (email = $1 OR ip = $2) AND sucesso = false AND criado_em > $3`,
    [email, ip, cutoff]
  );
  const count = parseInt(row?.count || '0');
  return { blocked: count >= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - count) };
}

/** Record a login attempt */
export async function recordLoginAttempt(email: string, ip: string, sucesso: boolean) {
  await query(
    'INSERT INTO login_attempts (email, ip, sucesso) VALUES ($1, $2, $3)',
    [email, ip, sucesso]
  );
  // Clean up old attempts (>24h)
  await query(`DELETE FROM login_attempts WHERE criado_em < NOW() - INTERVAL '24 hours'`).catch(() => {});
}

/** Record an audit log entry */
export async function auditLog(
  user: AuthRequest['user'] | null,
  acao: string,
  entidade?: string,
  entidadeId?: string,
  detalhes?: Record<string, any>,
  ip?: string
) {
  await query(
    `INSERT INTO audit_logs (user_id, user_nome, user_role, acao, entidade, entidade_id, detalhes, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      user?.id || null,
      user?.nome || null,
      user?.role || null,
      acao,
      entidade || null,
      entidadeId || null,
      detalhes ? JSON.stringify(detalhes) : '{}',
      ip || null,
    ]
  );
}

/** Record a usage metric */
export async function trackMetric(condominioId: string | null, userId: string, acao: string) {
  await query(
    'INSERT INTO metricas_uso (condominio_id, user_id, acao) VALUES ($1, $2, $3)',
    [condominioId, userId, acao]
  ).catch(() => {});
}

/** Create a notification for a user */
export async function createNotification(
  userId: string,
  titulo: string,
  mensagem?: string,
  tipo: string = 'info',
  link?: string
) {
  await query(
    'INSERT INTO notificacoes (user_id, titulo, mensagem, tipo, link) VALUES ($1, $2, $3, $4, $5)',
    [userId, titulo, mensagem || null, tipo, link || null]
  );
}
