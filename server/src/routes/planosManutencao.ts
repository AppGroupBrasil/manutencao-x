import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, planoManutencaoSchema } from '../middleware/validation.js';

const router = Router();

// ── Cálculo da próxima execução ──
function calcularProximaExecucao(frequencia: string, ultimaExecucao: Date | null, diaExecucao: number): Date {
  const base = ultimaExecucao ? new Date(ultimaExecucao) : new Date();
  const result = new Date(base);

  switch (frequencia) {
    case 'semanal': result.setDate(result.getDate() + 7); break;
    case 'quinzenal': result.setDate(result.getDate() + 15); break;
    case 'mensal': result.setMonth(result.getMonth() + 1); break;
    case 'bimestral': result.setMonth(result.getMonth() + 2); break;
    case 'trimestral': result.setMonth(result.getMonth() + 3); break;
    case 'semestral': result.setMonth(result.getMonth() + 6); break;
    case 'anual': result.setFullYear(result.getFullYear() + 1); break;
  }

  if (['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'].includes(frequencia) && diaExecucao) {
    result.setDate(Math.min(diaExecucao, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  }

  return result;
}

// GET /api/planos-manutencao
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT p.*, c.nome as condominio_nome, e.nome as equipamento_nome, e.codigo as equipamento_codigo,
            u.nome as responsavel_nome, f.nome as fornecedor_nome
     FROM planos_manutencao p
     LEFT JOIN condominios c ON c.id = p.condominio_id
     LEFT JOIN equipamentos e ON e.id = p.equipamento_id
     LEFT JOIN usuarios u ON u.id = p.responsavel_id
     LEFT JOIN fornecedores f ON f.id = p.fornecedor_id
     WHERE p.condominio_id = ANY($1)
     ORDER BY p.proxima_execucao ASC NULLS LAST`,
    [ids]
  );
  res.json(rows);
});

// GET /api/planos-manutencao/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    `SELECT p.*, c.nome as condominio_nome, e.nome as equipamento_nome
     FROM planos_manutencao p
     LEFT JOIN condominios c ON c.id = p.condominio_id
     LEFT JOIN equipamentos e ON e.id = p.equipamento_id
     WHERE p.id = $1 AND p.condominio_id = ANY($2)`,
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Plano não encontrado' }); return; }
  res.json(row);
});

// POST /api/planos-manutencao
router.post('/', validate(planoManutencaoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const {
    titulo, descricao, equipamentoId, categoriaEquipamento,
    frequencia, diaExecucao, itensVerificacao, responsavelId,
    fornecedorId, custoEstimado, autoGerarOs, status, condominioId
  } = req.body;

  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso ao condomínio' });
    return;
  }

  const proximaExecucao = calcularProximaExecucao(frequencia || 'mensal', null, diaExecucao || 1);

  const row = await queryOne(
    `INSERT INTO planos_manutencao (
      titulo, descricao, equipamento_id, categoria_equipamento,
      frequencia, dia_execucao, itens_verificacao, responsavel_id,
      fornecedor_id, custo_estimado, proxima_execucao, auto_gerar_os,
      status, condominio_id, criado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *`,
    [
      titulo, descricao, equipamentoId || null, categoriaEquipamento || null,
      frequencia || 'mensal', diaExecucao || 1,
      JSON.stringify(itensVerificacao || []), responsavelId || null,
      fornecedorId || null, custoEstimado || 0, proximaExecucao,
      autoGerarOs !== false, status || 'ativo', condominioId, req.user!.id
    ]
  );
  res.status(201).json(row);
});

// PUT /api/planos-manutencao/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const {
    titulo, descricao, equipamentoId, categoriaEquipamento,
    frequencia, diaExecucao, itensVerificacao, responsavelId,
    fornecedorId, custoEstimado, autoGerarOs, status
  } = req.body;

  const planoAtual = await queryOne<any>('SELECT * FROM planos_manutencao WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
  const proximaExecucao = (frequencia && frequencia !== planoAtual?.frequencia)
    ? calcularProximaExecucao(frequencia, planoAtual?.ultima_execucao, diaExecucao || planoAtual?.dia_execucao || 1)
    : undefined;

  const row = await queryOne(
    `UPDATE planos_manutencao SET
      titulo=$1, descricao=$2, equipamento_id=$3, categoria_equipamento=$4,
      frequencia=$5, dia_execucao=$6, itens_verificacao=$7, responsavel_id=$8,
      fornecedor_id=$9, custo_estimado=$10, auto_gerar_os=$11, status=$12,
      ${proximaExecucao ? 'proxima_execucao=$14,' : ''} atualizado_em=NOW()
     WHERE id=$13 AND condominio_id = ANY($${proximaExecucao ? 15 : 14}) RETURNING *`,
    [
      titulo, descricao, equipamentoId || null, categoriaEquipamento || null,
      frequencia, diaExecucao, JSON.stringify(itensVerificacao || []),
      responsavelId || null, fornecedorId || null, custoEstimado || 0,
      autoGerarOs !== false, status, req.params.id,
      ...(proximaExecucao ? [proximaExecucao] : []),
      ids
    ]
  );
  if (!row) { res.status(404).json({ error: 'Plano não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/planos-manutencao/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne('DELETE FROM planos_manutencao WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Plano não encontrado' }); return; }
  res.json({ ok: true });
});

// ── Execuções do Plano ──

// GET /api/planos-manutencao/:id/execucoes
router.get('/:id/execucoes', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const rows = await query(
    `SELECT pe.*, u.nome as executor_nome, f.nome as fornecedor_nome_rel
     FROM planos_execucoes pe
     LEFT JOIN usuarios u ON u.id = pe.executado_por
     LEFT JOIN fornecedores f ON f.id = pe.fornecedor_id
     JOIN planos_manutencao pm ON pm.id = pe.plano_id
     WHERE pe.plano_id = $1 AND pm.condominio_id = ANY($2)
     ORDER BY pe.data_execucao DESC`,
    [req.params.id, ids]
  );
  res.json(rows);
});

// POST /api/planos-manutencao/:id/execucoes
router.post('/:id/execucoes', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { dataExecucao, fornecedorId, custoReal, itensResultado, observacoes, fotos, status } = req.body;
  const planoId = req.params.id;

  // Verify plano belongs to user scope
  const planoCheck = await queryOne('SELECT id FROM planos_manutencao WHERE id = $1 AND condominio_id = ANY($2)', [planoId, ids]);
  if (!planoCheck) { res.status(404).json({ error: 'Plano não encontrado' }); return; }

  // Registrar execução
  const row = await queryOne(
    `INSERT INTO planos_execucoes (
      plano_id, data_execucao, executado_por, executado_por_nome,
      fornecedor_id, custo_real, itens_resultado, observacoes, fotos, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      planoId, dataExecucao || new Date(), req.user!.id, req.user!.nome,
      fornecedorId || null, custoReal || 0,
      JSON.stringify(itensResultado || []), observacoes, fotos || [],
      status || 'concluida'
    ]
  );

  // Atualizar plano: última execução e próxima
  const plano = await queryOne<any>('SELECT * FROM planos_manutencao WHERE id = $1', [planoId]);
  if (plano) {
    const proxima = calcularProximaExecucao(plano.frequencia, new Date(dataExecucao || new Date()), plano.dia_execucao || 1);
    await query(
      `UPDATE planos_manutencao SET ultima_execucao = $1, proxima_execucao = $2, atualizado_em = NOW() WHERE id = $3`,
      [dataExecucao || new Date(), proxima, planoId]
    );
  }

  res.status(201).json(row);
});

// GET /api/planos-manutencao/calendario/proximos
router.get('/calendario/proximos', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT p.id, p.titulo, p.frequencia, p.proxima_execucao, p.status,
            e.nome as equipamento_nome, e.codigo as equipamento_codigo,
            c.nome as condominio_nome, u.nome as responsavel_nome
     FROM planos_manutencao p
     LEFT JOIN equipamentos e ON e.id = p.equipamento_id
     LEFT JOIN condominios c ON c.id = p.condominio_id
     LEFT JOIN usuarios u ON u.id = p.responsavel_id
     WHERE p.condominio_id = ANY($1) AND p.status = 'ativo'
       AND p.proxima_execucao <= NOW() + INTERVAL '90 days'
     ORDER BY p.proxima_execucao ASC`,
    [ids]
  );
  res.json(rows);
});

export default router;
