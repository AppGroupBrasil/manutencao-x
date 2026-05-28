import { Router, Response } from 'express';
import { query, queryOne, execute, paginate } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, contratoSchema, contratoUpdateSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/contratos — listar contratos (com filtros)
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }); return; }

  const { status, vencendo } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  let where = 'fc.condominio_id = ANY($1)';
  const params: any[] = [ids];

  if (status && typeof status === 'string') {
    params.push(status);
    where += ` AND fc.status = $${params.length}`;
  }

  if (vencendo === 'true') {
    where += ` AND fc.data_fim IS NOT NULL AND fc.data_fim <= CURRENT_DATE + fc.alerta_dias_antes * INTERVAL '1 day'`;
  }

  const result = await paginate(
    `SELECT fc.*, f.nome as fornecedor_nome, f.especialidade as fornecedor_especialidade,
            c.nome as condominio_nome, u.nome as criado_por_nome
     FROM fornecedores_contratos fc
     JOIN fornecedores f ON f.id = fc.fornecedor_id
     JOIN condominios c ON c.id = fc.condominio_id
     LEFT JOIN usuarios u ON u.id = fc.criado_por
     WHERE ${where}
     ORDER BY fc.data_fim ASC NULLS LAST`,
    params, page, pageSize
  );
  res.json(result);
});

// GET /api/contratos/resumo — resumo de contratos
router.get('/resumo', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json({ vigentes: 0, vencendo: 0, encerrados: 0, valorTotal: 0 }); return; }

  const resumo = await queryOne(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'vigente') as vigentes,
       COUNT(*) FILTER (WHERE status = 'vigente' AND data_fim IS NOT NULL AND data_fim <= CURRENT_DATE + alerta_dias_antes * INTERVAL '1 day') as vencendo,
       COUNT(*) FILTER (WHERE status = 'encerrado') as encerrados,
       COALESCE(SUM(valor) FILTER (WHERE status = 'vigente'), 0) as valor_total
     FROM fornecedores_contratos
     WHERE condominio_id = ANY($1)`,
    [ids]
  );
  res.json(resumo);
});

// GET /api/contratos/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne(
    `SELECT fc.*, f.nome as fornecedor_nome, f.especialidade as fornecedor_especialidade,
            f.telefone as fornecedor_telefone, f.email as fornecedor_email,
            c.nome as condominio_nome, u.nome as criado_por_nome
     FROM fornecedores_contratos fc
     JOIN fornecedores f ON f.id = fc.fornecedor_id
     JOIN condominios c ON c.id = fc.condominio_id
     LEFT JOIN usuarios u ON u.id = fc.criado_por
     WHERE fc.id = $1 AND fc.condominio_id = ANY($2)`,
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Contrato não encontrado' }); return; }
  res.json(row);
});

// POST /api/contratos
router.post('/', validate(contratoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const {
    fornecedorId, condominioId, numeroContrato, descricao, valor,
    dataInicio, dataFim, renovacaoAutomatica, alertaDiasAntes,
    status, documentoUrl, observacoes
  } = req.body;

  if (!fornecedorId || !condominioId) {
    res.status(400).json({ error: 'fornecedorId e condominioId são obrigatórios' });
    return;
  }
  if (!ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso ao condomínio' });
    return;
  }

  const row = await queryOne(
    `INSERT INTO fornecedores_contratos (
       fornecedor_id, condominio_id, numero_contrato, descricao, valor,
       data_inicio, data_fim, renovacao_automatica, alerta_dias_antes,
       status, documento_url, observacoes, criado_por
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      fornecedorId, condominioId, numeroContrato || null, descricao || null,
      valor || null, dataInicio || null, dataFim || null,
      renovacaoAutomatica || false, alertaDiasAntes || 30,
      status || 'vigente', documentoUrl || null, observacoes || null,
      req.user!.id
    ]
  );
  res.status(201).json(row);
});

// PUT /api/contratos/:id
router.put('/:id', validate(contratoUpdateSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const {
    numeroContrato, descricao, valor, dataInicio, dataFim,
    renovacaoAutomatica, alertaDiasAntes, status, documentoUrl, observacoes
  } = req.body;

  const row = await queryOne(
    `UPDATE fornecedores_contratos SET
       numero_contrato=$1, descricao=$2, valor=$3, data_inicio=$4, data_fim=$5,
       renovacao_automatica=$6, alerta_dias_antes=$7, status=$8,
       documento_url=$9, observacoes=$10, atualizado_em=NOW()
     WHERE id=$11 AND condominio_id = ANY($12) RETURNING *`,
    [
      numeroContrato, descricao, valor || null, dataInicio || null, dataFim || null,
      renovacaoAutomatica || false, alertaDiasAntes || 30, status,
      documentoUrl || null, observacoes || null, req.params.id, ids
    ]
  );
  if (!row) { res.status(404).json({ error: 'Contrato não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/contratos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  await execute('DELETE FROM fornecedores_contratos WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
  res.json({ ok: true });
});

export default router;
