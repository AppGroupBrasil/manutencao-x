import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { query } from '../db/database.js';

const ROLE_LEVEL: Record<string, number> = {
  master: 4,
  administrador: 3,
  supervisor: 2,
  funcionario: 1,
};

/** Requer nível mínimo de papel */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Permissão insuficiente' });
      return;
    }
    next();
  };
}

/** Requer nível mínimo (ex.: supervisor = supervisor + admin + master) */
export function requireMinRole(minRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    const userLevel = ROLE_LEVEL[req.user.role] ?? 0;
    const requiredLevel = ROLE_LEVEL[minRole] ?? 99;
    if (userLevel < requiredLevel) {
      res.status(403).json({ error: 'Permissão insuficiente' });
      return;
    }
    next();
  };
}

/**
 * Filtra dados por escopo do usuário na hierarquia:
 * - master: vê tudo
 * - administrador: vê só condominios que criou
 * - supervisor: vê condominios delegados pelo admin
 * - funcionário: vê só seu condominio
 */
export async function getCondominiosScope(user: AuthRequest['user']): Promise<string[]> {
  if (!user) return [];

  if (user.role === 'master') {
    const rows = await query<{ id: string }>('SELECT id FROM condominios');
    return rows.map(r => r.id);
  }

  if (user.role === 'administrador') {
    const rows = await query<{ id: string }>(
      'SELECT id FROM condominios WHERE criado_por = $1 AND ativo = true',
      [user.id]
    );
    return rows.map(r => r.id);
  }

  if (user.role === 'supervisor') {
    // Supervisor vê condominios dos funcionários que supervisiona + seu próprio
    const rows = await query<{ id: string }>(
      `SELECT DISTINCT c.id FROM condominios c
       WHERE c.ativo = true AND (
         c.id IN (SELECT condominio_id FROM usuarios WHERE supervisor_id = $1 AND condominio_id IS NOT NULL)
         OR c.id = $2
       )`,
      [user.id, user.condominio_id]
    );
    return rows.map(r => r.id);
  }

  // funcionario
  return user.condominio_id ? [user.condominio_id] : [];
}

/** Middleware que injeta req.condominioIds para filtragem */
export async function scopeMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const ids = await getCondominiosScope(req.user);
  (req as any).condominioIds = ids;
  next();
}
