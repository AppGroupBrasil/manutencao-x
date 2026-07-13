import { Router, Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, antesDepoisSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/antes-depois?checklistId=&vistoriaId=
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }
  const { checklistId, vistoriaId } = req.query;
  const params: unknown[] = [ids];
  let where = 'condominio_id = ANY($1)';
  if (checklistId) { params.push(checklistId); where += ` AND checklist_id = $${params.length}`; }
  if (vistoriaId) { params.push(vistoriaId); where += ` AND vistoria_id = $${params.length}`; }
  const rows = await query(
    `SELECT * FROM registros_antes_depois WHERE ${where} ORDER BY criado_em DESC`,
    params
  );
  res.json(rows);
});

// POST /api/antes-depois
router.post('/', validate(antesDepoisSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { condominioId, checklistId, vistoriaId, itemId, itemDesc, fotoAntes, descAntes, fotoDepois, descDepois } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso a este condomínio' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO registros_antes_depois
       (condominio_id, checklist_id, vistoria_id, item_id, item_desc, foto_antes, desc_antes, foto_depois, desc_depois, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [condominioId, checklistId || null, vistoriaId || null, itemId || null, itemDesc || null,
     fotoAntes || null, descAntes || null, fotoDepois || null, descDepois || null, req.user!.id]
  );
  res.status(201).json(row);
});

// DELETE /api/antes-depois/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne(
    'DELETE FROM registros_antes_depois WHERE id = $1 AND condominio_id = ANY($2) RETURNING id',
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Registro não encontrado' }); return; }
  res.json({ ok: true });
});

export default router;
