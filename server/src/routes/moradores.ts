import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, moradorSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/moradores
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT m.*, c.nome as condominio_nome FROM moradores m
     LEFT JOIN condominios c ON c.id = m.condominio_id
     WHERE m.condominio_id = ANY($1) ORDER BY m.nome`,
    [ids]
  );
  res.json(rows);
});

// POST /api/moradores
router.post('/', validate(moradorSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { nome, condominioId, bloco, apartamento, whatsapp, email, perfil } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO moradores (nome, condominio_id, bloco, apartamento, whatsapp, email, perfil)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [nome, condominioId, bloco, apartamento, whatsapp, email, perfil || 'Proprietário']
  );
  res.status(201).json(row);
});

// PUT /api/moradores/:id
router.put('/:id', validate(moradorSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { nome, bloco, apartamento, whatsapp, email, perfil } = req.body;
  const row = await queryOne(
    `UPDATE moradores SET nome=$1, bloco=$2, apartamento=$3, whatsapp=$4, email=$5, perfil=$6
     WHERE id=$7 AND condominio_id = ANY($8) RETURNING *`,
    [nome, bloco, apartamento, whatsapp, email, perfil, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Morador não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/moradores/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM moradores WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Morador não encontrado' }); return; }
  res.json({ ok: true });
});

// ── WhatsApp Contatos ──

// GET /api/moradores/whatsapp-contatos
router.get('/whatsapp-contatos', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT * FROM whats_contatos WHERE condominio_id IS NULL OR condominio_id = ANY($1) ORDER BY nome`,
    [ids]
  );
  res.json(rows);
});

// POST /api/moradores/whatsapp-contatos
router.post('/whatsapp-contatos', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { nome, telefone, condominioId } = req.body;
  if (condominioId && !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' }); return;
  }
  const row = await queryOne(
    `INSERT INTO whats_contatos (nome, telefone, condominio_id) VALUES ($1,$2,$3) RETURNING *`,
    [nome, telefone, condominioId]
  );
  res.status(201).json(row);
});

// DELETE /api/moradores/whatsapp-contatos/:id
router.delete('/whatsapp-contatos/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM whats_contatos WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2)) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Contato não encontrado' }); return; }
  res.json({ ok: true });
});

export default router;
