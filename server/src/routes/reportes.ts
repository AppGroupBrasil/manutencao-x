import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, reporteSchema } from '../middleware/validation.js';

const router = Router();

function gerarProtocolo(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `RPT-${y}${m}${d}-${r}`;
}

// GET /api/reportes
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT r.*, c.nome as condominio_nome FROM reportes r
     LEFT JOIN condominios c ON c.id = r.condominio_id
     WHERE r.condominio_id = ANY($1) ORDER BY r.data DESC`,
    [ids]
  );
  res.json(rows);
});

// POST /api/reportes
router.post('/', validate(reporteSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { condominioId, itemDesc, checklistId, vistoriaId, descricao, prioridade, imagens } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' });
    return;
  }
  const protocolo = gerarProtocolo();
  const row = await queryOne(
    `INSERT INTO reportes (protocolo, condominio_id, item_desc, checklist_id, vistoria_id, descricao, prioridade, imagens, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [protocolo, condominioId, itemDesc, checklistId, vistoriaId, descricao, prioridade || 'media', imagens || [], req.user!.id]
  );
  res.status(201).json(row);
});

// PATCH /api/reportes/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { status } = req.body;
  const row = await queryOne(
    'UPDATE reportes SET status = $1 WHERE id = $2 AND condominio_id = ANY($3) RETURNING *',
    [status, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Reporte não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/reportes/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM reportes WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Reporte não encontrado' }); return; }
  res.json({ ok: true });
});

export default router;
