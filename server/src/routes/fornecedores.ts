import { Router, Response } from 'express';
import { query, queryOne, execute, paginate } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, fornecedorSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/fornecedores
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }); return; }
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const result = await paginate(
    `SELECT f.*, c.nome as condominio_nome
     FROM fornecedores f
     LEFT JOIN condominios c ON c.id = f.condominio_id
     WHERE f.condominio_id = ANY($1)
     ORDER BY f.nome`,
    [ids], page, pageSize
  );
  res.json(result);
});

// GET /api/fornecedores/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    `SELECT f.*, c.nome as condominio_nome
     FROM fornecedores f
     LEFT JOIN condominios c ON c.id = f.condominio_id
     WHERE f.id = $1 AND f.condominio_id = ANY($2)`,
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Fornecedor não encontrado' }); return; }
  res.json(row);
});

// POST /api/fornecedores
router.post('/', validate(fornecedorSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const {
    nome, cnpj, tipo, especialidade, telefone, email, endereco, cidade, estado,
    contatoNome, contatoTelefone, contatoEmail, observacoes,
    valorContrato, dataInicioContrato, dataFimContrato, status, condominioId
  } = req.body;

  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso ao condomínio' });
    return;
  }

  const row = await queryOne(
    `INSERT INTO fornecedores (
      nome, cnpj, tipo, especialidade, telefone, email, endereco, cidade, estado,
      contato_nome, contato_telefone, contato_email, observacoes,
      valor_contrato, data_inicio_contrato, data_fim_contrato, status,
      condominio_id, criado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING *`,
    [
      nome, cnpj, tipo || 'prestador', especialidade, telefone, email, endereco, cidade, estado,
      contatoNome, contatoTelefone, contatoEmail, observacoes,
      valorContrato || null, dataInicioContrato || null, dataFimContrato || null,
      status || 'ativo', condominioId, req.user!.id
    ]
  );
  res.status(201).json(row);
});

// PUT /api/fornecedores/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const {
    nome, cnpj, tipo, especialidade, telefone, email, endereco, cidade, estado,
    contatoNome, contatoTelefone, contatoEmail, observacoes,
    valorContrato, dataInicioContrato, dataFimContrato, status
  } = req.body;

  const row = await queryOne(
    `UPDATE fornecedores SET
      nome=$1, cnpj=$2, tipo=$3, especialidade=$4, telefone=$5, email=$6,
      endereco=$7, cidade=$8, estado=$9, contato_nome=$10, contato_telefone=$11,
      contato_email=$12, observacoes=$13, valor_contrato=$14,
      data_inicio_contrato=$15, data_fim_contrato=$16, status=$17, atualizado_em=NOW()
     WHERE id=$18 AND condominio_id = ANY($19) RETURNING *`,
    [
      nome, cnpj, tipo, especialidade, telefone, email, endereco, cidade, estado,
      contatoNome, contatoTelefone, contatoEmail, observacoes,
      valorContrato || null, dataInicioContrato || null, dataFimContrato || null,
      status, req.params.id, ids
    ]
  );
  if (!row) { res.status(404).json({ error: 'Fornecedor não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/fornecedores/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  await execute('DELETE FROM fornecedores WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
  res.json({ ok: true });
});

// ── Avaliações ──

// GET /api/fornecedores/:id/avaliacoes
router.get('/:id/avaliacoes', async (req: AuthRequest, res: Response) => {
  const rows = await query(
    `SELECT a.*, u.nome as avaliador_nome
     FROM fornecedores_avaliacoes a
     LEFT JOIN usuarios u ON u.id = a.avaliado_por
     WHERE a.fornecedor_id = $1
     ORDER BY a.criado_em DESC`,
    [req.params.id]
  );
  res.json(rows);
});

// POST /api/fornecedores/:id/avaliacoes
router.post('/:id/avaliacoes', async (req: AuthRequest, res: Response) => {
  const { nota, comentario, osId } = req.body;
  if (!nota || nota < 1 || nota > 5) {
    res.status(400).json({ error: 'Nota deve ser entre 1 e 5' });
    return;
  }

  const row = await queryOne(
    `INSERT INTO fornecedores_avaliacoes (fornecedor_id, os_id, nota, comentario, avaliado_por)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.id, osId || null, nota, comentario, req.user!.id]
  );

  // Atualizar média do fornecedor
  await query(
    `UPDATE fornecedores SET
      avaliacao_media = (SELECT AVG(nota) FROM fornecedores_avaliacoes WHERE fornecedor_id = $1),
      total_servicos = (SELECT COUNT(*) FROM fornecedores_avaliacoes WHERE fornecedor_id = $1)
     WHERE id = $1`,
    [req.params.id]
  );

  res.status(201).json(row);
});

export default router;
