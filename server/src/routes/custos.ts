import { Router, Response } from 'express';
import { query } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/custos — Resumo de custos com filtros
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json({ items: [], resumo: {} }); return; }

  const { periodo, condominioId, equipamentoId, categoriaOs } = req.query;

  let dateFilter = '';
  const params: any[] = [ids];
  let idx = 2;

  if (periodo === 'mes') {
    dateFilter = `AND o.data_abertura >= NOW() - INTERVAL '30 days'`;
  } else if (periodo === 'trimestre') {
    dateFilter = `AND o.data_abertura >= NOW() - INTERVAL '90 days'`;
  } else if (periodo === 'semestre') {
    dateFilter = `AND o.data_abertura >= NOW() - INTERVAL '180 days'`;
  } else if (periodo === 'ano') {
    dateFilter = `AND o.data_abertura >= NOW() - INTERVAL '365 days'`;
  }

  let condFilter = '';
  if (condominioId && condominioId !== 'todos') {
    condFilter = `AND o.condominio_id = $${idx}`;
    params.push(condominioId);
    idx++;
  }

  let eqFilter = '';
  if (equipamentoId && equipamentoId !== 'todos') {
    eqFilter = `AND o.equipamento_id = $${idx}`;
    params.push(equipamentoId);
    idx++;
  }

  let catFilter = '';
  if (categoriaOs && categoriaOs !== 'todos') {
    catFilter = `AND o.tipo = $${idx}`;
    params.push(categoriaOs);
    idx++;
  }

  // Lista de OS com custos
  const items = await query(
    `SELECT o.id, o.titulo, o.status, o.prioridade, o.tipo,
            o.custo_material, o.custo_mao_obra, o.custo_terceiros,
            COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0) AS custo_total,
            o.tempo_execucao_min, o.data_abertura, o.data_conclusao,
            c.nome AS condominio_nome,
            e.nome AS equipamento_nome, e.codigo AS equipamento_codigo,
            f.nome AS fornecedor_nome
     FROM ordens_servico o
     LEFT JOIN condominios c ON c.id = o.condominio_id
     LEFT JOIN equipamentos e ON e.id = o.equipamento_id
     LEFT JOIN fornecedores f ON f.id = o.fornecedor_id
     WHERE o.condominio_id = ANY($1)
       AND (COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0)) > 0
       ${dateFilter} ${condFilter} ${eqFilter} ${catFilter}
     ORDER BY o.data_abertura DESC
     LIMIT 500`,
    params
  );

  // Resumo agregado
  const [resumo] = await query(
    `SELECT
       COUNT(*)::int AS total_os,
       COALESCE(SUM(COALESCE(custo_material,0)),0)::float AS total_material,
       COALESCE(SUM(COALESCE(custo_mao_obra,0)),0)::float AS total_mao_obra,
       COALESCE(SUM(COALESCE(custo_terceiros,0)),0)::float AS total_terceiros,
       COALESCE(SUM(COALESCE(custo_material,0) + COALESCE(custo_mao_obra,0) + COALESCE(custo_terceiros,0)),0)::float AS total_geral,
       COALESCE(AVG(NULLIF(COALESCE(custo_material,0) + COALESCE(custo_mao_obra,0) + COALESCE(custo_terceiros,0),0)),0)::float AS media_por_os
     FROM ordens_servico o
     WHERE o.condominio_id = ANY($1)
       AND (COALESCE(custo_material,0) + COALESCE(custo_mao_obra,0) + COALESCE(custo_terceiros,0)) > 0
       ${dateFilter} ${condFilter} ${eqFilter} ${catFilter}`,
    params
  );

  res.json({ items, resumo });
});

// GET /api/custos/por-condominio — Custo total agrupado por condomínio
router.get('/por-condominio', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }

  const rows = await query(
    `SELECT c.nome, c.id,
       SUM(COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0))::float AS total,
       COUNT(*)::int AS quantidade
     FROM ordens_servico o
     JOIN condominios c ON c.id = o.condominio_id
     WHERE o.condominio_id = ANY($1)
       AND (COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0)) > 0
     GROUP BY c.id, c.nome
     ORDER BY total DESC`,
    [ids]
  );
  res.json(rows);
});

// GET /api/custos/por-categoria — Custo agrupado por categoria de OS
router.get('/por-categoria', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }

  const rows = await query(
    `SELECT COALESCE(o.tipo, 'sem_categoria') AS categoria,
       SUM(COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0))::float AS total,
       COUNT(*)::int AS quantidade
     FROM ordens_servico o
     WHERE o.condominio_id = ANY($1)
       AND (COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0)) > 0
     GROUP BY o.tipo
     ORDER BY total DESC`,
    [ids]
  );
  res.json(rows);
});

// GET /api/custos/evolucao — Custo mensal dos últimos 12 meses
router.get('/evolucao', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }

  const rows = await query(
    `SELECT TO_CHAR(o.data_abertura, 'YYYY-MM') AS mes,
       SUM(COALESCE(o.custo_material,0))::float AS material,
       SUM(COALESCE(o.custo_mao_obra,0))::float AS mao_obra,
       SUM(COALESCE(o.custo_terceiros,0))::float AS terceiros,
       SUM(COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0))::float AS total,
       COUNT(*)::int AS quantidade
     FROM ordens_servico o
     WHERE o.condominio_id = ANY($1)
       AND o.data_abertura >= NOW() - INTERVAL '12 months'
       AND (COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0)) > 0
     GROUP BY TO_CHAR(o.data_abertura, 'YYYY-MM')
     ORDER BY mes`,
    [ids]
  );
  res.json(rows);
});

// GET /api/custos/por-equipamento — Top equipamentos por custo
router.get('/por-equipamento', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }

  const rows = await query(
    `SELECT e.id, e.nome, e.codigo, e.categoria,
       SUM(COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0))::float AS total,
       COUNT(*)::int AS quantidade_os,
       AVG(COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0))::float AS media
     FROM ordens_servico o
     JOIN equipamentos e ON e.id = o.equipamento_id
     WHERE o.condominio_id = ANY($1)
       AND o.equipamento_id IS NOT NULL
       AND (COALESCE(o.custo_material,0) + COALESCE(o.custo_mao_obra,0) + COALESCE(o.custo_terceiros,0)) > 0
     GROUP BY e.id, e.nome, e.codigo, e.categoria
     ORDER BY total DESC
     LIMIT 20`,
    [ids]
  );
  res.json(rows);
});

export default router;
