import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, quadroAtividadeSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/quadro-atividades
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT qa.*, c.nome as condominio_nome FROM quadro_atividades qa
     LEFT JOIN condominios c ON c.id = qa.condominio_id
     WHERE qa.condominio_id = ANY($1) ORDER BY qa.criado_em DESC`,
    [ids]
  );
  res.json(rows);
});

// POST /api/quadro-atividades
router.post('/', validate(quadroAtividadeSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { titulo, descricao, status, prioridade, rotina, dataEspecifica, responsavelId, responsavelNome, condominioId } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO quadro_atividades (titulo, descricao, status, prioridade, rotina, data_especifica, responsavel_id, responsavel_nome, condominio_id, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [titulo, descricao, status || 'a_fazer', prioridade || 'media', rotina || 'diaria', dataEspecifica, responsavelId, responsavelNome, condominioId, req.user!.id]
  );
  res.status(201).json(row);
});

// PUT /api/quadro-atividades/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { titulo, descricao, prioridade, rotina, dataEspecifica, responsavelId, responsavelNome } = req.body;
  const row = await queryOne(
    `UPDATE quadro_atividades SET titulo=$1, descricao=$2, prioridade=$3, rotina=$4, data_especifica=$5, responsavel_id=$6, responsavel_nome=$7
     WHERE id=$8 AND condominio_id = ANY($9) RETURNING *`,
    [titulo, descricao, prioridade, rotina, dataEspecifica, responsavelId, responsavelNome, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Atividade não encontrada' }); return; }
  res.json(row);
});

// PATCH /api/quadro-atividades/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { status } = req.body;
  const existing = await queryOne<any>('SELECT historico FROM quadro_atividades WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
  if (!existing) { res.status(404).json({ error: 'Atividade não encontrada' }); return; }
  const historico = existing?.historico || [];
  historico.push({ status, data: new Date().toISOString(), usuario: req.user!.nome });

  const row = await queryOne(
    'UPDATE quadro_atividades SET status = $1, historico = $2 WHERE id = $3 AND condominio_id = ANY($4) RETURNING *',
    [status, JSON.stringify(historico), req.params.id, ids]
  );
  res.json(row);
});

// DELETE /api/quadro-atividades/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne('DELETE FROM quadro_atividades WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Atividade não encontrada' }); return; }
  res.json({ ok: true });
});

export default router;
