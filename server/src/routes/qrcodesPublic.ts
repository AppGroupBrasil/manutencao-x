import { Router, Request, Response } from 'express';
import { query, queryOne } from '../db/database.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/qrcodes-public/:id — formulário público (sem login)
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) { res.status(404).json({ error: 'Formulário não encontrado' }); return; }
  const row = await queryOne(
    `SELECT id, nome, descricao, logo, blocos, dispensar_identificacao, blocos_cadastrados, ativo
     FROM qrcodes WHERE id = $1`,
    [id]
  ) as any;
  if (!row) { res.status(404).json({ error: 'Formulário não encontrado' }); return; }
  if (!row.ativo) { res.status(410).json({ error: 'Este formulário foi desativado' }); return; }
  res.json(row);
});

// POST /api/qrcodes-public/:id/respostas — resposta sem login (anônima ou identificada)
router.post('/:id/respostas', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) { res.status(404).json({ error: 'Formulário não encontrado' }); return; }
  const qr = await queryOne(`SELECT id, nome, ativo FROM qrcodes WHERE id = $1`, [id]) as any;
  if (!qr) { res.status(404).json({ error: 'Formulário não encontrado' }); return; }
  if (!qr.ativo) { res.status(410).json({ error: 'Este formulário foi desativado' }); return; }

  const { identificacao, respostas, latitude, longitude, endereco } = req.body || {};
  if (!respostas || typeof respostas !== 'object' || Array.isArray(respostas)) {
    res.status(400).json({ error: 'Respostas inválidas' });
    return;
  }
  const ident = identificacao && typeof identificacao === 'object' && !Array.isArray(identificacao) ? identificacao : {};
  const nome = !ident.anonimo && typeof ident.nome === 'string' && ident.nome.trim()
    ? ident.nome.trim().slice(0, 255)
    : 'Anônimo';

  const row = await queryOne(
    `INSERT INTO respostas_qrcode (qrcode_id, qrcode_nome, identificacao, respostas, respondido_por, respondido_por_nome, respondido_por_email, latitude, longitude, endereco)
     VALUES ($1,$2,$3,$4,NULL,$5,NULL,$6,$7,$8) RETURNING *`,
    [qr.id, qr.nome, JSON.stringify(ident), JSON.stringify(respostas), nome, latitude ?? null, longitude ?? null, endereco ?? null]
  );
  await query(`UPDATE qrcodes SET respostas = respostas + 1 WHERE id = $1`, [qr.id]);
  res.status(201).json(row);
});

export default router;
