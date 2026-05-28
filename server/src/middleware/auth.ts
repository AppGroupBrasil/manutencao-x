import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne, query } from '../db/database.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('[SECURITY] ❌ JWT_SECRET ausente ou curto (<32 chars). Encerrando.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '24h') as jwt.SignOptions['expiresIn'];
const APP_SLUG = 'manutencao-x';
const STATUS_VALIDOS_LICENCA = new Set(['ativa', 'trial']);
const ISSUER_CENTRAL = process.env.AUTH_CENTRAL_ISSUER || 'auth-central';
const ISSUER_LOCAL = process.env.JWT_ISSUER || 'manutencao-x';

function mapearRoleCentral(role: string): string {
  const r = (role || '').toLowerCase();
  if (r === 'superadmin' || r === 'master') return 'master';
  if (r === 'admin' || r === 'administrador') return 'administrador';
  if (r === 'supervisor') return 'supervisor';
  return 'funcionario';
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    nome: string;
    role: string;
    administrador_id: string | null;
    supervisor_id: string | null;
    condominio_id: string | null;
    ativo: boolean;
    bloqueado: boolean;
  };
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, issuer: ISSUER_LOCAL });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, { issuer: [ISSUER_LOCAL, ISSUER_CENTRAL] }) as JwtPayload;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  try {
    const raw: any = jwt.verify(header.slice(7), JWT_SECRET, { issuer: [ISSUER_LOCAL, ISSUER_CENTRAL] });
    const userId: string = raw.userId || raw.sub;

    // Token do auth-central (com array apps[]) — exige iss === central explícito
    if (Array.isArray(raw.apps)) {
      if (raw.iss !== ISSUER_CENTRAL) {
        res.status(401).json({ error: 'Token inválido: emissor inesperado' });
        return;
      }
      const licenca = raw.apps.find((a: any) => a.slug === APP_SLUG);
      if (!licenca || !STATUS_VALIDOS_LICENCA.has(licenca.status)) {
        res.status(403).json({ error: 'Sem licença ativa para Manutenção X' });
        return;
      }
      if (licenca.expira_em && new Date(licenca.expira_em) < new Date()) {
        res.status(403).json({ error: 'Licença expirada' });
        return;
      }
      const existing = await queryOne(`SELECT id FROM usuarios WHERE id = $1`, [userId]);
      if (!existing) {
        const roleLocal = mapearRoleCentral(licenca.role);
        await query(
          `INSERT INTO usuarios (id, email, senha_hash, nome, role, ativo)
           VALUES ($1, $2, '!central!', $3, $4::user_role, true)
           ON CONFLICT (id) DO NOTHING`,
          [userId, raw.email, raw.nome || raw.email, roleLocal]
        );
      }
    }

    const user = await queryOne(
      `SELECT id, email, nome, role, administrador_id, supervisor_id, condominio_id, ativo, bloqueado
       FROM usuarios WHERE id = $1`,
      [userId]
    );

    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }
    if (!user.ativo || user.bloqueado) {
      res.status(403).json({ error: 'Conta desativada ou bloqueada' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}
