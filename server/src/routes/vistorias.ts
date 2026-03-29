import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, vistoriaSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/vistorias
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT v.*, c.nome as condominio_nome FROM vistorias v
     LEFT JOIN condominios c ON c.id = v.condominio_id
     WHERE v.condominio_id = ANY($1) ORDER BY v.data DESC`,
    [ids]
  );
  res.json(rows);
});

// GET /api/vistorias/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    `SELECT v.*, c.nome as condominio_nome FROM vistorias v
     LEFT JOIN condominios c ON c.id = v.condominio_id
     WHERE v.id = $1 AND v.condominio_id = ANY($2)`,
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Vistoria não encontrada' }); return; }
  res.json(row);
});

// POST /api/vistorias
router.post('/', validate(vistoriaSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { titulo, condominioId, tipo, data, responsavelNome, itens } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO vistorias (titulo, condominio_id, tipo, data, responsavel_id, responsavel_nome, itens)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [titulo, condominioId, tipo || 'rotina', data || new Date().toISOString().slice(0, 10), req.user!.id, responsavelNome || req.user!.nome, JSON.stringify(itens || [])]
  );
  res.status(201).json(row);
});

// PUT /api/vistorias/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { titulo, tipo, data, itens, status, responsavelNome } = req.body;
  const row = await queryOne(
    `UPDATE vistorias SET titulo=$1, tipo=$2, data=$3, itens=$4, status=$5, responsavel_nome=$6
     WHERE id=$7 AND condominio_id = ANY($8) RETURNING *`,
    [titulo, tipo, data, JSON.stringify(itens), status, responsavelNome, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Vistoria não encontrada' }); return; }
  res.json(row);
});

// DELETE /api/vistorias/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne('DELETE FROM vistorias WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Vistoria não encontrada' }); return; }
  res.json({ ok: true });
});

export default router;
