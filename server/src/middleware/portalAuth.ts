import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('[SECURITY] ❌ JWT_SECRET não definido em produção! Encerrando.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-unsafe-secret';
const PORTAL_ISSUER = 'portal-morador';

export interface PortalJwtPayload {
  moradorId: string;
  email: string;
  iss: string;
}

export interface PortalRequest extends Request {
  morador?: {
    id: string;
    nome: string;
    email: string;
    condominioId: string;
    bloco: string | null;
    apartamento: string | null;
    whatsapp: string | null;
    perfil: string;
    avatarUrl: string | null;
  };
}

export function generatePortalToken(payload: Omit<PortalJwtPayload, 'iss'>): string {
  return jwt.sign({ ...payload, iss: PORTAL_ISSUER }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyPortalToken(token: string): PortalJwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as PortalJwtPayload;
  if (decoded.iss !== PORTAL_ISSUER) {
    throw new Error('Token inválido para o portal');
  }
  return decoded;
}

export async function portalAuthMiddleware(req: PortalRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  try {
    const decoded = verifyPortalToken(header.slice(7));
    const morador = await queryOne(
      `SELECT id, nome, email, condominio_id, bloco, apartamento, whatsapp, perfil, avatar_url, ativo
       FROM moradores WHERE id = $1`,
      [decoded.moradorId]
    );

    if (!morador) {
      res.status(401).json({ error: 'Morador não encontrado' });
      return;
    }
    if (!morador.ativo) {
      res.status(403).json({ error: 'Conta desativada' });
      return;
    }

    req.morador = {
      id: morador.id,
      nome: morador.nome,
      email: morador.email,
      condominioId: morador.condominio_id,
      bloco: morador.bloco,
      apartamento: morador.apartamento,
      whatsapp: morador.whatsapp,
      perfil: morador.perfil,
      avatarUrl: morador.avatar_url,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}
