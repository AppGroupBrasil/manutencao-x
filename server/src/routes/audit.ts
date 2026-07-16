import { Router, Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// GET /api/audit — master: tudo; administrador: logs da própria equipe
router.get('/', requireRole('master', 'administrador'), async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;

  const isMaster = req.user!.role === 'master';
  const scope = isMaster ? '' : 'WHERE user_id IN (SELECT id FROM usuarios WHERE administrador_id = $1 OR id = $1)';
  const scopeParams: any[] = isMaster ? [] : [req.user!.id];

  const countRow = await queryOne<{ total: string }>(`SELECT COUNT(*) as total FROM audit_logs ${scope}`, scopeParams);
  const rows = await query(
    `SELECT * FROM audit_logs ${scope} ORDER BY criado_em DESC LIMIT $${scopeParams.length + 1} OFFSET $${scopeParams.length + 2}`,
    [...scopeParams, limit, offset]
  );

  res.json({
    data: rows,
    pagination: {
      page,
      limit,
      total: parseInt(countRow?.total || '0'),
      pages: Math.ceil(parseInt(countRow?.total || '0') / limit),
    },
  });
});

// GET /api/audit/metrics — master: tudo; administrador: escopo próprio
router.get('/metrics', requireRole('master', 'administrador'), async (req: AuthRequest, res: Response) => {
  const isMaster = req.user!.role === 'master';

  // Usage summary by condominio (last 30 days)
  const metricas = await query(
    `SELECT c.id, c.nome,
       COUNT(DISTINCT m.user_id) as usuarios_ativos,
       COUNT(m.id) as total_acoes,
       MAX(m.criado_em) as ultima_atividade
     FROM condominios c
     LEFT JOIN metricas_uso m ON m.condominio_id = c.id AND m.data >= CURRENT_DATE - 30
     ${isMaster ? '' : 'WHERE c.id = ANY($1)'}
     GROUP BY c.id, c.nome
     ORDER BY total_acoes DESC`,
    isMaster ? [] : [req.condominioIds || []]
  );

  // Login counts per day (last 30 days)
  const logins = await query(
    `SELECT DATE(criado_em) as dia, COUNT(*) as total
     FROM login_attempts WHERE sucesso = true AND criado_em >= CURRENT_DATE - 30
     ${isMaster ? '' : 'AND email IN (SELECT email FROM usuarios WHERE administrador_id = $1 OR id = $1)'}
     GROUP BY DATE(criado_em) ORDER BY dia`,
    isMaster ? [] : [req.user!.id]
  );

  res.json({ metricas, logins });
});

export default router;
