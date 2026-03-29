import { Router, Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// GET /api/audit — master: list audit logs
router.get('/', requireRole('master'), async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;

  const countRow = await queryOne<{ total: string }>('SELECT COUNT(*) as total FROM audit_logs');
  const rows = await query(
    `SELECT * FROM audit_logs ORDER BY criado_em DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
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

// GET /api/audit/metrics — master: usage metrics per condominio
router.get('/metrics', requireRole('master'), async (req: AuthRequest, res: Response) => {
  // Usage summary by condominio (last 30 days)
  const metricas = await query(
    `SELECT c.id, c.nome, 
       COUNT(DISTINCT m.user_id) as usuarios_ativos,
       COUNT(m.id) as total_acoes,
       MAX(m.criado_em) as ultima_atividade
     FROM condominios c
     LEFT JOIN metricas_uso m ON m.condominio_id = c.id AND m.data >= CURRENT_DATE - 30
     GROUP BY c.id, c.nome
     ORDER BY total_acoes DESC`
  );

  // Login counts per day (last 30 days)
  const logins = await query(
    `SELECT DATE(criado_em) as dia, COUNT(*) as total
     FROM login_attempts WHERE sucesso = true AND criado_em >= CURRENT_DATE - 30
     GROUP BY DATE(criado_em) ORDER BY dia`
  );

  res.json({ metricas, logins });
});

export default router;
