import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, inspecaoSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/inspecoes
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT i.*, c.nome as condominio_nome, u.nome as inspetor_nome
     FROM inspecoes i
     LEFT JOIN condominios c ON c.id = i.condominio_id
     LEFT JOIN usuarios u ON u.id = i.inspetor_id
     WHERE i.condominio_id = ANY($1)
     ORDER BY i.data DESC`,
    [ids]
  );
  res.json(rows);
});

// GET /api/inspecoes/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne(
    `SELECT i.*, c.nome as condominio_nome, u.nome as inspetor_nome
     FROM inspecoes i
     LEFT JOIN condominios c ON c.id = i.condominio_id
     LEFT JOIN usuarios u ON u.id = i.inspetor_id
     WHERE i.id = $1 AND i.condominio_id = ANY($2)`,
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Inspeção não encontrada' }); return; }
  res.json(row);
});

// POST /api/inspecoes
router.post('/', validate(inspecaoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { condominioId, tipo, local, itensVerificados, observacoes, fotos, status } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO inspecoes (condominio_id, tipo, local, inspetor_id, itens_verificados, observacoes, fotos, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [condominioId, tipo, local, req.user!.id, JSON.stringify(itensVerificados || []), observacoes, fotos || [], status || 'pendente']
  );
  res.status(201).json(row);
});

// PUT /api/inspecoes/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { tipo, local, itensVerificados, observacoes, fotos, status } = req.body;
  const row = await queryOne(
    `UPDATE inspecoes SET tipo=$1, local=$2, itens_verificados=$3, observacoes=$4, fotos=$5, status=$6
     WHERE id=$7 AND condominio_id = ANY($8) RETURNING *`,
    [tipo, local, JSON.stringify(itensVerificados), observacoes, fotos, status, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Inspeção não encontrada' }); return; }
  res.json(row);
});

// DELETE /api/inspecoes/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne('DELETE FROM inspecoes WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Inspeção não encontrada' }); return; }
  res.json({ ok: true });
});

export default router;
