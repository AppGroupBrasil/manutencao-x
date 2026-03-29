import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] ❌ JWT_SECRET não definido em produção! Encerrando.');
    process.exit(1);
  }
  console.warn('[SECURITY] ⚠️  JWT_SECRET não definido! Usando fallback inseguro de desenvolvimento.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-unsafe-secret';

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  try {
    const decoded = verifyToken(header.slice(7));
    const user = await queryOne(
      `SELECT id, email, nome, role, administrador_id, supervisor_id, condominio_id, ativo, bloqueado
       FROM usuarios WHERE id = $1`,
      [decoded.userId]
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
