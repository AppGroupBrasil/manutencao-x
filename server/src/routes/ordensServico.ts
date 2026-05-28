import { Router, Response } from 'express';
import { query, queryOne, execute, paginate } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, ordemServicoSchema, ordemServicoStatusSchema, ordemServicoAvaliacaoSchema, ordemServicoUpdateSchema } from '../middleware/validation.js';

const router = Router();

function gerarProtocolo(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `OS-${y}${m}${d}-${r}`;
}

// GET /api/ordens-servico
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }); return; }
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const result = await paginate(
    `SELECT os.*, c.nome as condominio_nome, u.nome as responsavel_nome
     FROM ordens_servico os
     LEFT JOIN condominios c ON c.id = os.condominio_id
     LEFT JOIN usuarios u ON u.id = os.responsavel_id
     WHERE os.condominio_id = ANY($1)
     ORDER BY os.data_abertura DESC`,
    [ids], page, pageSize
  );
  res.json(result);
});

// GET /api/ordens-servico/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne(
    `SELECT os.*, c.nome as condominio_nome FROM ordens_servico os
     LEFT JOIN condominios c ON c.id = os.condominio_id
     WHERE os.id = $1`,
    [req.params.id]
  );
  if (!row || !ids.includes((row as any).condominio_id)) {
    res.status(404).json({ error: 'OS não encontrada' });
    return;
  }
  res.json(row);
});

// POST /api/ordens-servico
router.post('/', validate(ordemServicoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { condominioId, titulo, descricao, tipo, prioridade, local, responsavelId, supervisorId, dataPrevisao } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso a este condomínio' });
    return;
  }
  const protocolo = gerarProtocolo();
  const row = await queryOne(
    `INSERT INTO ordens_servico (protocolo, condominio_id, titulo, descricao, tipo, prioridade, local, responsavel_id, supervisor_id, data_previsao, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [protocolo, condominioId, titulo, descricao, tipo || 'limpeza', prioridade || 'media', local, responsavelId, supervisorId, dataPrevisao, req.user!.id]
  );
  res.status(201).json(row);
});

// PATCH /api/ordens-servico/:id/status
router.patch('/:id/status', validate(ordemServicoStatusSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { status } = req.body;
  const extra = status === 'concluida' ? ', data_conclusao = NOW()' : '';
  const row = await queryOne(
    `UPDATE ordens_servico SET status = $1 ${extra} WHERE id = $2 AND condominio_id = ANY($3) RETURNING *`,
    [status, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  res.json(row);
});

// PATCH /api/ordens-servico/:id/avaliacao
router.patch('/:id/avaliacao', validate(ordemServicoAvaliacaoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { nota, comentario } = req.body;
  const row = await queryOne(
    `UPDATE ordens_servico SET avaliacao_nota = $1, avaliacao_comentario = $2 WHERE id = $3 AND condominio_id = ANY($4) RETURNING *`,
    [nota, comentario, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  res.json(row);
});

// PUT /api/ordens-servico/:id
router.put('/:id', validate(ordemServicoUpdateSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { titulo, descricao, tipo, prioridade, local, responsavelId, supervisorId, observacoes, fotos, dataPrevisao } = req.body;
  const row = await queryOne(
    `UPDATE ordens_servico SET titulo=$1, descricao=$2, tipo=$3, prioridade=$4, local=$5,
     responsavel_id=$6, supervisor_id=$7, observacoes=$8, fotos=$9, data_previsao=$10
     WHERE id=$11 AND condominio_id = ANY($12) RETURNING *`,
    [titulo, descricao, tipo, prioridade, local, responsavelId, supervisorId, observacoes, fotos || [], dataPrevisao, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  res.json(row);
});

// DELETE /api/ordens-servico/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM ordens_servico WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  res.json({ ok: true });
});

export default router;
