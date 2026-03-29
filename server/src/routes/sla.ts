import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';

import { apiCache } from '../middleware/cache.js';

const router = Router();

// ── GET /api/sla/configuracoes — listar configs SLA do escopo
router.get('/configuracoes', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT s.*, c.nome as condominio_nome
     FROM sla_configuracoes s
     LEFT JOIN condominios c ON c.id = s.condominio_id
     WHERE s.condominio_id = ANY($1)
     ORDER BY c.nome, s.prioridade`,
    [ids]
  );
  res.json(rows);
});

// ── PUT /api/sla/configuracoes — upsert configurações SLA de um condomínio
router.put('/configuracoes', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { condominioId, configuracoes } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso a este condomínio' });
    return;
  }
  const defaults = [
    { prioridade: 'urgente', tempoResposta: 2, tempoResolucao: 12 },
    { prioridade: 'alta', tempoResposta: 4, tempoResolucao: 24 },
    { prioridade: 'media', tempoResposta: 8, tempoResolucao: 48 },
    { prioridade: 'baixa', tempoResposta: 24, tempoResolucao: 120 },
  ];
  const configs = configuracoes || defaults;
  const results: any[] = [];

  for (const cfg of configs) {
    const row = await queryOne(
      `INSERT INTO sla_configuracoes (condominio_id, prioridade, tempo_resposta_horas, tempo_resolucao_horas,
        notificar_alerta, notificar_violacao, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (condominio_id, prioridade)
       DO UPDATE SET tempo_resposta_horas = $3, tempo_resolucao_horas = $4,
         notificar_alerta = $5, notificar_violacao = $6, atualizado_em = NOW()
       RETURNING *`,
      [
        condominioId, cfg.prioridade,
        cfg.tempoResposta || cfg.tempo_resposta_horas || 8,
        cfg.tempoResolucao || cfg.tempo_resolucao_horas || 48,
        cfg.notificarAlerta !== false,
        cfg.notificarViolacao !== false,
        req.user!.id,
      ]
    );
    results.push(row);
  }
  res.json(results);
});

// ── GET /api/sla/dashboard — resumo SLA
router.get('/dashboard', apiCache(60), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) {
    res.json({ total: 0, dentroPrazo: 0, emRisco: 0, violadas: 0, taxaCumprimento: 0, porPrioridade: [] });
    return;
  }

  const stats = await queryOne<any>(
    `SELECT
       COUNT(*) FILTER (WHERE status != 'concluida' AND status != 'cancelada') as total_abertas,
       COUNT(*) FILTER (WHERE sla_status = 'dentro_prazo' AND status != 'concluida' AND status != 'cancelada') as dentro_prazo,
       COUNT(*) FILTER (WHERE sla_status = 'em_risco' AND status != 'concluida' AND status != 'cancelada') as em_risco,
       COUNT(*) FILTER (WHERE sla_status = 'violado' AND status != 'concluida' AND status != 'cancelada') as violadas,
       COUNT(*) FILTER (WHERE status = 'concluida' AND sla_status != 'violado') as concluidas_no_prazo,
       COUNT(*) FILTER (WHERE status = 'concluida') as total_concluidas
     FROM ordens_servico WHERE condominio_id = ANY($1)`,
    [ids]
  );

  const porPrioridade = await query(
    `SELECT prioridade,
       COUNT(*) FILTER (WHERE sla_status = 'dentro_prazo') as dentro_prazo,
       COUNT(*) FILTER (WHERE sla_status = 'em_risco') as em_risco,
       COUNT(*) FILTER (WHERE sla_status = 'violado') as violadas
     FROM ordens_servico
     WHERE condominio_id = ANY($1) AND status != 'concluida' AND status != 'cancelada'
     GROUP BY prioridade ORDER BY prioridade`,
    [ids]
  );

  const totalConc = parseInt(stats?.total_concluidas || '0');
  const noPrazo = parseInt(stats?.concluidas_no_prazo || '0');

  res.json({
    totalAbertas: parseInt(stats?.total_abertas || '0'),
    dentroPrazo: parseInt(stats?.dentro_prazo || '0'),
    emRisco: parseInt(stats?.em_risco || '0'),
    violadas: parseInt(stats?.violadas || '0'),
    taxaCumprimento: totalConc > 0 ? Math.round((noPrazo / totalConc) * 100) : 100,
    porPrioridade,
  });
});

// ── GET /api/sla/violacoes — OS com SLA violado ou em risco
router.get('/violacoes', apiCache(60), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT os.id, os.protocolo, os.titulo, os.prioridade, os.status, os.sla_status,
            os.sla_resposta_limite, os.sla_resolucao_limite, os.data_abertura,
            c.nome as condominio_nome, u.nome as responsavel_nome
     FROM ordens_servico os
     LEFT JOIN condominios c ON c.id = os.condominio_id
     LEFT JOIN usuarios u ON u.id = os.responsavel_id
     WHERE os.condominio_id = ANY($1) AND os.sla_status IN ('em_risco', 'violado')
       AND os.status NOT IN ('concluida', 'cancelada')
     ORDER BY os.sla_resolucao_limite ASC NULLS LAST`,
    [ids]
  );
  res.json(rows);
});

// ── PATCH /api/sla/recalcular — recalcular SLA de todas as OS abertas
router.patch('/recalcular', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const now = new Date();

  // Marcar "em_risco" quando faltam menos de 25% do tempo
  await execute(
    `UPDATE ordens_servico SET sla_status = 'em_risco'
     WHERE condominio_id = ANY($1) AND status NOT IN ('concluida','cancelada')
       AND sla_resolucao_limite IS NOT NULL
       AND sla_status = 'dentro_prazo'
       AND sla_resolucao_limite - INTERVAL '1 hour' * (EXTRACT(EPOCH FROM (sla_resolucao_limite - data_abertura)) / 3600 * 0.25) < $2`,
    [ids, now]
  );

  // Marcar "violado" quando passou do limite
  await execute(
    `UPDATE ordens_servico SET sla_status = 'violado'
     WHERE condominio_id = ANY($1) AND status NOT IN ('concluida','cancelada')
       AND sla_resolucao_limite IS NOT NULL AND sla_resolucao_limite < $2
       AND sla_status != 'violado'`,
    [ids, now]
  );

  res.json({ ok: true, recalculadoEm: now });
});

export default router;

