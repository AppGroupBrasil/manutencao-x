import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, comunicadoSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/comunicados
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT cm.*, c.nome as condominio_nome FROM comunicados cm
     LEFT JOIN condominios c ON c.id = cm.condominio_id
     WHERE cm.condominio_id = ANY($1) ORDER BY cm.criado_em DESC`,
    [ids]
  );
  res.json(rows);
});

// POST /api/comunicados
router.post('/', validate(comunicadoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { tipo, titulo, mensagem, destinatarioTipo, condominioId, emailsEnviados, tracking } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO comunicados (tipo, titulo, mensagem, destinatario_tipo, condominio_id, emails_enviados, tracking, enviado_por, enviado_por_nome)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [tipo || 'comunicado', titulo, mensagem, destinatarioTipo, condominioId, emailsEnviados || [], JSON.stringify(tracking || []), req.user!.id, req.user!.nome]
  );
  res.status(201).json(row);
});

// PUT /api/comunicados/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { tipo, titulo, mensagem, destinatarioTipo } = req.body;
  const row = await queryOne(
    `UPDATE comunicados SET tipo = COALESCE($1, tipo), titulo = COALESCE($2, titulo),
       mensagem = COALESCE($3, mensagem), destinatario_tipo = COALESCE($4, destinatario_tipo)
     WHERE id = $5 AND condominio_id = ANY($6) RETURNING *`,
    [tipo, titulo, mensagem, destinatarioTipo, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Comunicado não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/comunicados/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM comunicados WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Comunicado não encontrado' }); return; }
  res.json({ ok: true });
});

export default router;
