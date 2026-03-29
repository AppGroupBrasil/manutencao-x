import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, checklistSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/checklists
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT ch.*, c.nome as condominio_nome, u.nome as responsavel_nome
     FROM checklists ch
     LEFT JOIN condominios c ON c.id = ch.condominio_id
     LEFT JOIN usuarios u ON u.id = ch.responsavel_id
     WHERE ch.condominio_id = ANY($1)
     ORDER BY ch.data DESC`,
    [ids]
  );
  res.json(rows);
});

// POST /api/checklists
router.post('/', validate(checklistSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { condominioId, local, tipo, itens, responsavelId, supervisorId, data } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso a este condomínio' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO checklists (condominio_id, local, tipo, itens, responsavel_id, supervisor_id, data, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [condominioId, local, tipo || 'diaria', JSON.stringify(itens || []), responsavelId || req.user!.id, supervisorId, data || new Date().toISOString().slice(0, 10), req.user!.id]
  );
  res.status(201).json(row);
});

// ── Locais pré-cadastrados (ANTES de /:id para não conflitar) ──

// GET /api/checklists/locais
router.get('/locais', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT * FROM checklists_locais WHERE condominio_id = ANY($1) OR condominio_id IS NULL ORDER BY nome`,
    [ids]
  );
  res.json(rows);
});

// POST /api/checklists/locais
router.post('/locais', async (req: AuthRequest, res: Response) => {
  const { nome, itensPadrao, condominioId } = req.body;
  if (!nome?.trim()) { res.status(400).json({ error: 'Nome é obrigatório' }); return; }
  const row = await queryOne(
    `INSERT INTO checklists_locais (condominio_id, nome, itens_padrao) VALUES ($1, $2, $3) RETURNING *`,
    [condominioId || null, nome.trim(), itensPadrao || []]
  );
  res.status(201).json(row);
});

// PUT /api/checklists/locais/:id
router.put('/locais/:id', async (req: AuthRequest, res: Response) => {
  const { nome, itensPadrao } = req.body;
  if (!nome?.trim()) { res.status(400).json({ error: 'Nome é obrigatório' }); return; }
  const row = await queryOne(
    `UPDATE checklists_locais SET nome = $1, itens_padrao = $2 WHERE id = $3 RETURNING *`,
    [nome.trim(), itensPadrao || [], req.params.id]
  );
  if (!row) { res.status(404).json({ error: 'Local não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/checklists/locais/:id
router.delete('/locais/:id', async (req: AuthRequest, res: Response) => {
  const row = await queryOne('DELETE FROM checklists_locais WHERE id = $1 RETURNING id', [req.params.id]);
  if (!row) { res.status(404).json({ error: 'Local não encontrado' }); return; }
  res.json({ ok: true });
});

// PUT /api/checklists/:id
router.put('/:id', validate(checklistSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { local, tipo, itens, status, horaInicio, horaFim, assinatura } = req.body;
  const row = await queryOne(
    `UPDATE checklists SET local=$1, tipo=$2, itens=$3, status=$4, hora_inicio=$5, hora_fim=$6, assinatura=$7
     WHERE id=$8 AND condominio_id = ANY($9) RETURNING *`,
    [local, tipo, JSON.stringify(itens), status, horaInicio, horaFim, assinatura, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Checklist não encontrado' }); return; }
  res.json(row);
});

// PATCH /api/checklists/:id/itens
router.patch('/:id/itens', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { itens, status, horaFim, assinatura } = req.body;
  const fields: string[] = ['itens = $1'];
  const params: any[] = [JSON.stringify(itens)];
  let idx = 2;
  if (status) { fields.push(`status = $${idx++}`); params.push(status); }
  if (horaFim) { fields.push(`hora_fim = $${idx++}`); params.push(horaFim); }
  if (assinatura) { fields.push(`assinatura = $${idx++}`); params.push(assinatura); }
  params.push(req.params.id);
  params.push(ids);
  const row = await queryOne(
    `UPDATE checklists SET ${fields.join(', ')} WHERE id = $${idx} AND condominio_id = ANY($${idx + 1}) RETURNING *`,
    params
  );
  if (!row) { res.status(404).json({ error: 'Checklist não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/checklists/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne('DELETE FROM checklists WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Checklist não encontrado' }); return; }
  res.json({ ok: true });
});

export default router;
