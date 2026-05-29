import { Router, Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/sindico/resumo — resumo do síndico (admin-level)
router.get('/resumo', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) {
    res.json({ condominios: 0, osAbertas: 0, osConcluidas: 0, osConcluidasMes: 0, slaVioladas: 0, solicitacoesPendentes: 0, solicitacoesTotal: 0, moradores: 0, custoMes: 0, comunicadosMes: 0, osRecentes: [] });
    return;
  }

  const [condsCount, osStats, qrStats, qrRecentes, moradoresCount, custoMes, osRecentes, comunicadosCount] = await Promise.all([
    queryOne<any>('SELECT COUNT(*) as total FROM condominios WHERE id = ANY($1)', [ids]),
    queryOne<any>(
      `SELECT
         COUNT(*) FILTER (WHERE status NOT IN ('concluida','cancelada')) as abertas,
         COUNT(*) FILTER (WHERE status = 'concluida') as concluidas,
         COUNT(*) FILTER (WHERE status = 'concluida' AND data_conclusao >= NOW() - INTERVAL '30 days') as concluidas_mes,
         COUNT(*) FILTER (WHERE sla_status = 'violado' AND status NOT IN ('concluida','cancelada')) as sla_violadas
       FROM ordens_servico WHERE condominio_id = ANY($1)`,
      [ids]
    ),
    // Conta respostas QR Code (via qrcodes vinculados ao condomínio ou globais)
    queryOne<any>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE r.respondido_em >= NOW() - INTERVAL '7 days') as ultimos7dias
       FROM respostas_qrcode r
       JOIN qrcodes q ON q.id = r.qrcode_id
       WHERE q.condominio_id IS NULL OR q.condominio_id = ANY($1)`,
      [ids]
    ),
    // Solicitações recentes via QR Code
    query(
      `SELECT r.id, r.qrcode_nome, r.identificacao, r.respondido_por_nome, r.respondido_em, r.endereco
       FROM respostas_qrcode r
       JOIN qrcodes q ON q.id = r.qrcode_id
       WHERE q.condominio_id IS NULL OR q.condominio_id = ANY($1)
       ORDER BY r.respondido_em DESC LIMIT 8`,
      [ids]
    ),
    queryOne<any>('SELECT COUNT(*) as total FROM moradores WHERE condominio_id = ANY($1) AND ativo = true', [ids]),
    queryOne<any>(
      `SELECT COALESCE(SUM(COALESCE(custo_material,0) + COALESCE(custo_mao_obra,0) + COALESCE(custo_terceiros,0)), 0) as total
       FROM ordens_servico
       WHERE condominio_id = ANY($1) AND data_abertura >= date_trunc('month', CURRENT_DATE)`,
      [ids]
    ),
    query(
      `SELECT os.id, os.protocolo, os.titulo, os.status, os.prioridade, os.data_abertura, c.nome as condominio_nome
       FROM ordens_servico os
       LEFT JOIN condominios c ON c.id = os.condominio_id
       WHERE os.condominio_id = ANY($1) AND os.status NOT IN ('concluida','cancelada')
       ORDER BY os.data_abertura DESC LIMIT 10`,
      [ids]
    ),
    queryOne<any>(
      `SELECT COUNT(*) as total FROM comunicados
       WHERE condominio_id = ANY($1) AND criado_em >= NOW() - INTERVAL '30 days'`,
      [ids]
    ),
  ]);

  res.json({
    condominios: parseInt(condsCount?.total || '0'),
    osAbertas: parseInt(osStats?.abertas || '0'),
    osConcluidas: parseInt(osStats?.concluidas || '0'),
    osConcluidasMes: parseInt(osStats?.concluidas_mes || '0'),
    slaVioladas: parseInt(osStats?.sla_violadas || '0'),
    solicitacoesPendentes: parseInt(qrStats?.ultimos7dias || '0'),
    solicitacoesTotal: parseInt(qrStats?.total || '0'),
    solicitacoesRecentes: qrRecentes,
    moradores: parseInt(moradoresCount?.total || '0'),
    custoMes: parseFloat(custoMes?.total || '0'),
    comunicadosMes: parseInt(comunicadosCount?.total || '0'),
    osRecentes,
  });
});

// GET /api/sindico/os-por-condominio
router.get('/os-por-condominio', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT c.nome, c.id,
       COUNT(*) FILTER (WHERE os.status NOT IN ('concluida','cancelada')) as abertas,
       COUNT(*) FILTER (WHERE os.status = 'concluida') as concluidas,
       COUNT(*) as total
     FROM condominios c
     LEFT JOIN ordens_servico os ON os.condominio_id = c.id
     WHERE c.id = ANY($1)
     GROUP BY c.id, c.nome
     ORDER BY abertas DESC`,
    [ids]
  );
  res.json(rows);
});

// GET /api/sindico/evolucao-mensal
router.get('/evolucao-mensal', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT to_char(data_abertura, 'YYYY-MM') as mes,
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'concluida') as concluidas,
       COALESCE(SUM(COALESCE(custo_material,0) + COALESCE(custo_mao_obra,0) + COALESCE(custo_terceiros,0)), 0) as custo
     FROM ordens_servico
     WHERE condominio_id = ANY($1) AND data_abertura >= NOW() - INTERVAL '12 months'
     GROUP BY to_char(data_abertura, 'YYYY-MM')
     ORDER BY mes`,
    [ids]
  );
  res.json(rows);
});

export default router;
