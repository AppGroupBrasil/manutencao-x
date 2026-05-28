import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, vencimentoSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/vencimentos
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT v.*, c.nome as condominio_nome FROM vencimentos v
     LEFT JOIN condominios c ON c.id = v.condominio_id
     WHERE v.condominio_id = ANY($1) ORDER BY v.data_vencimento`,
    [ids]
  );
  res.json(rows);
});

// POST /api/vencimentos
router.post('/', validate(vencimentoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { titulo, tipo, descricao, condominioId, dataVencimento, dataUltimaManutencao, dataProximaManutencao, emails, avisos, imagens } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO vencimentos (titulo, tipo, descricao, condominio_id, data_vencimento, data_ultima_manutencao, data_proxima_manutencao, emails, avisos, imagens)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [titulo, tipo, descricao, condominioId, dataVencimento, dataUltimaManutencao, dataProximaManutencao, emails || [], JSON.stringify(avisos || []), imagens || []]
  );
  res.status(201).json(row);
});

// PUT /api/vencimentos/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { titulo, tipo, descricao, dataVencimento, dataUltimaManutencao, dataProximaManutencao, emails, avisos, imagens, qtdNotificacoes } = req.body;
  const row = await queryOne(
    `UPDATE vencimentos SET titulo=$1, tipo=$2, descricao=$3, data_vencimento=$4, data_ultima_manutencao=$5,
     data_proxima_manutencao=$6, emails=$7, avisos=$8, imagens=$9, qtd_notificacoes=$10
     WHERE id=$11 AND condominio_id = ANY($12) RETURNING *`,
    [titulo, tipo, descricao, dataVencimento, dataUltimaManutencao, dataProximaManutencao, emails, JSON.stringify(avisos), imagens, qtdNotificacoes || 0, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Vencimento não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/vencimentos/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM vencimentos WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Vencimento não encontrado' }); return; }
  res.json({ ok: true });
});

// ── Emails globais de vencimentos ──

// GET /api/vencimentos/emails
router.get('/emails/global', async (_req: AuthRequest, res: Response) => {
  const row = await queryOne('SELECT emails FROM vencimentos_emails WHERE id = $1', ['global']);
  res.json(row || { emails: [] });
});

// PUT /api/vencimentos/emails
router.put('/emails/global', async (req: AuthRequest, res: Response) => {
  const { emails } = req.body;
  const row = await queryOne(
    `INSERT INTO vencimentos_emails (id, emails) VALUES ('global', $1)
     ON CONFLICT (id) DO UPDATE SET emails = $1 RETURNING *`,
    [emails || []]
  );
  res.json(row);
});

export default router;
