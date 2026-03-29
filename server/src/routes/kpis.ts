import { Router, Response } from 'express';
import { query } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/kpis — Todos os KPIs de manutenção
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) {
    res.json({
      mtbf: 0, mttr: 0, disponibilidade: 100, backlog: 0,
      custoTotal: 0, custoMedio: 0, osConcluidas: 0, osAbertas: 0,
      taxaConclusao: 0, preventivasVsCorretivas: { preventivas: 0, corretivas: 0 },
      tempoMedioResposta: 0, reincidencia: 0,
    });
    return;
  }

  const { periodo } = req.query;
  let dateFilter = '';
  if (periodo === 'mes') dateFilter = `AND o.data_abertura >= NOW() - INTERVAL '30 days'`;
  else if (periodo === 'trimestre') dateFilter = `AND o.data_abertura >= NOW() - INTERVAL '90 days'`;
  else if (periodo === 'semestre') dateFilter = `AND o.data_abertura >= NOW() - INTERVAL '180 days'`;
  else if (periodo === 'ano') dateFilter = `AND o.data_abertura >= NOW() - INTERVAL '365 days'`;

  // KPIs gerais de ordens de serviço
  const [stats] = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'concluida')::int AS os_concluidas,
       COUNT(*) FILTER (WHERE status IN ('aberta','em_andamento'))::int AS os_abertas,
       COUNT(*)::int AS os_total,
       COALESCE(SUM(COALESCE(custo_material,0) + COALESCE(custo_mao_obra,0) + COALESCE(custo_terceiros,0)),0)::float AS custo_total,
       COALESCE(AVG(NULLIF(COALESCE(custo_material,0) + COALESCE(custo_mao_obra,0) + COALESCE(custo_terceiros,0),0)),0)::float AS custo_medio,
       COALESCE(AVG(NULLIF(tempo_execucao_min,0)),0)::float AS tempo_medio_exec,
       COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(data_conclusao, NOW()) - data_abertura))/3600) FILTER (WHERE status = 'concluida'),0)::float AS mttr_horas,
       COUNT(*) FILTER (WHERE tipo = 'preventiva')::int AS preventivas,
       COUNT(*) FILTER (WHERE tipo != 'preventiva' OR tipo IS NULL)::int AS corretivas
     FROM ordens_servico o
     WHERE condominio_id = ANY($1) ${dateFilter}`,
    [ids]
  );

  // MTBF — Média de tempo entre falhas (equipamentos com mais de 1 OS corretiva)
  const [mtbfData] = await query(
    `SELECT COALESCE(AVG(diff_hours),0)::float AS mtbf
     FROM (
       SELECT equipamento_id,
         EXTRACT(EPOCH FROM (LEAD(data_abertura) OVER (PARTITION BY equipamento_id ORDER BY data_abertura) - data_abertura))/3600 AS diff_hours
       FROM ordens_servico
       WHERE condominio_id = ANY($1)
         AND equipamento_id IS NOT NULL
         AND (tipo != 'preventiva' OR tipo IS NULL)
         ${dateFilter}
     ) sub WHERE diff_hours IS NOT NULL`,
    [ids]
  );

  // Backlog — OS abertas há mais de 7 dias
  const [backlog] = await query(
    `SELECT COUNT(*)::int AS backlog
     FROM ordens_servico
     WHERE condominio_id = ANY($1)
       AND status IN ('aberta','em_andamento')
       AND data_abertura < NOW() - INTERVAL '7 days'`,
    [ids]
  );

  // Reincidência — equipamentos com mais de 1 OS corretiva em 90 dias
  const [reincidencia] = await query(
    `SELECT COUNT(DISTINCT equipamento_id)::int AS reincidencia
     FROM (
       SELECT equipamento_id, COUNT(*) AS cnt
       FROM ordens_servico
       WHERE condominio_id = ANY($1)
         AND equipamento_id IS NOT NULL
         AND (tipo != 'preventiva' OR tipo IS NULL)
         AND data_abertura >= NOW() - INTERVAL '90 days'
       GROUP BY equipamento_id
       HAVING COUNT(*) > 1
     ) sub`,
    [ids]
  );

  // Tempo médio de resposta (criação → início do andamento)
  const [tempoResposta] = await query(
    `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(data_conclusao, data_abertura) - data_abertura))/3600),0)::float AS horas
     FROM ordens_servico
     WHERE condominio_id = ANY($1)
       AND status IN ('em_andamento','concluida')
       ${dateFilter}`,
    [ids]
  );

  const osTotal = stats.os_total || 1;
  const taxaConclusao = stats.os_total > 0 ? Math.round((stats.os_concluidas / stats.os_total) * 100) : 0;
  const totalEquip = await query(`SELECT COUNT(*)::int AS total FROM equipamentos WHERE condominio_id = ANY($1) AND status = 'ativo'`, [ids]);
  const totalEquipAtivos = totalEquip[0]?.total || 1;

  // Disponibilidade = (equip ativos - equip em manutenção) / equip ativos * 100
  const [dispData] = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'ativo')::int AS ativos,
       COUNT(*) FILTER (WHERE status = 'manutencao')::int AS em_manutencao,
       COUNT(*)::int AS total
     FROM equipamentos WHERE condominio_id = ANY($1)`,
    [ids]
  );
  const disponibilidade = dispData.total > 0
    ? Math.round(((dispData.total - dispData.em_manutencao) / dispData.total) * 100)
    : 100;

  res.json({
    mtbf: Math.round(mtbfData.mtbf * 10) / 10,
    mttr: Math.round(stats.mttr_horas * 10) / 10,
    disponibilidade,
    backlog: backlog.backlog,
    custoTotal: Math.round(stats.custo_total * 100) / 100,
    custoMedio: Math.round(stats.custo_medio * 100) / 100,
    osConcluidas: stats.os_concluidas,
    osAbertas: stats.os_abertas,
    taxaConclusao,
    preventivasVsCorretivas: { preventivas: stats.preventivas, corretivas: stats.corretivas },
    tempoMedioResposta: Math.round(tempoResposta.horas * 10) / 10,
    reincidencia: reincidencia.reincidencia,
    totalEquipamentos: totalEquipAtivos,
  });
});

// GET /api/kpis/equipamentos — KPIs por equipamento
router.get('/equipamentos', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }

  const rows = await query(
    `SELECT e.id, e.nome, e.codigo, e.categoria, e.status,
       COUNT(o.id)::int AS total_os,
       COUNT(o.id) FILTER (WHERE o.status = 'concluida')::int AS os_concluidas,
       COUNT(o.id) FILTER (WHERE o.tipo != 'preventiva' OR o.tipo IS NULL)::int AS corretivas,
       COUNT(o.id) FILTER (WHERE o.tipo = 'preventiva')::int AS preventivas,
       COALESCE(SUM(COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0)),0)::float AS custo_total,
       COALESCE(AVG(NULLIF(o.tempo_execucao_min,0)),0)::float AS tempo_medio,
       MAX(o.data_abertura) AS ultima_os
     FROM equipamentos e
     LEFT JOIN ordens_servico o ON o.equipamento_id = e.id
     WHERE e.condominio_id = ANY($1)
     GROUP BY e.id, e.nome, e.codigo, e.categoria, e.status
     ORDER BY custo_total DESC`,
    [ids]
  );
  res.json(rows);
});

// GET /api/kpis/tendencia — Evolução mensal de KPIs
router.get('/tendencia', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }

  const rows = await query(
    `SELECT TO_CHAR(data_abertura, 'YYYY-MM') AS mes,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'concluida')::int AS concluidas,
       COUNT(*) FILTER (WHERE tipo = 'preventiva')::int AS preventivas,
       COALESCE(SUM(COALESCE(custo_material,0) + COALESCE(custo_mao_obra,0) + COALESCE(custo_terceiros,0)),0)::float AS custo,
       COALESCE(AVG(NULLIF(tempo_execucao_min,0)),0)::float AS tempo_medio
     FROM ordens_servico
     WHERE condominio_id = ANY($1)
       AND data_abertura >= NOW() - INTERVAL '12 months'
     GROUP BY TO_CHAR(data_abertura, 'YYYY-MM')
     ORDER BY mes`,
    [ids]
  );
  res.json(rows);
});

export default router;
