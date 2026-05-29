import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole } from '../middleware/rbac.js';
import { validate, qrcodeSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/qrcodes
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT * FROM qrcodes WHERE condominio_id IS NULL OR condominio_id = ANY($1) ORDER BY criado_em DESC`,
    [ids]
  );
  res.json(rows);
});

// GET /api/qrcodes/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('SELECT * FROM qrcodes WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2))', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'QR Code não encontrado' }); return; }
  res.json(row);
});

// POST /api/qrcodes
router.post('/', validate(qrcodeSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { nome, descricao, logo, blocos, dispensarIdentificacao, blocosCadastrados, condominioId } = req.body;
  if (condominioId && !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' }); return;
  }
  const row = await queryOne(
    `INSERT INTO qrcodes (nome, descricao, logo, blocos, dispensar_identificacao, blocos_cadastrados, condominio_id, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [nome, descricao, logo, JSON.stringify(blocos || []), dispensarIdentificacao || false, blocosCadastrados || [], condominioId, req.user!.id]
  );
  res.status(201).json(row);
});

// PUT /api/qrcodes/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { nome, descricao, logo, blocos, dispensarIdentificacao, blocosCadastrados } = req.body;
  const row = await queryOne(
    `UPDATE qrcodes SET nome=$1, descricao=$2, logo=$3, blocos=$4, dispensar_identificacao=$5, blocos_cadastrados=$6
     WHERE id=$7 AND (condominio_id IS NULL OR condominio_id = ANY($8)) RETURNING *`,
    [nome, descricao, logo, JSON.stringify(blocos), dispensarIdentificacao, blocosCadastrados, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'QR Code não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/qrcodes/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM qrcodes WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2)) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'QR Code não encontrado' }); return; }
  res.json({ ok: true });
});

// ── Respostas dos Formulários QR Code ──

// GET /api/qrcodes/respostas/all
router.get('/respostas/all', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT r.* FROM respostas_qrcode r
     JOIN qrcodes q ON q.id = r.qrcode_id
     WHERE q.condominio_id IS NULL OR q.condominio_id = ANY($1)
     ORDER BY r.respondido_em DESC LIMIT 500`,
    [ids]
  );
  res.json(rows);
});

// GET /api/qrcodes/respostas/:qrcodeId
router.get('/respostas/:qrcodeId', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT r.* FROM respostas_qrcode r
     JOIN qrcodes q ON q.id = r.qrcode_id
     WHERE r.qrcode_id = $1 AND (q.condominio_id IS NULL OR q.condominio_id = ANY($2))
     ORDER BY r.respondido_em DESC LIMIT 500`,
    [req.params.qrcodeId, ids]
  );
  res.json(rows);
});

// POST /api/qrcodes/respostas
router.post('/respostas', async (req: AuthRequest, res: Response) => {
  const { qrcodeId, qrcodeNome, identificacao, respostas, latitude, longitude, endereco } = req.body;
  const row = await queryOne(
    `INSERT INTO respostas_qrcode (qrcode_id, qrcode_nome, identificacao, respostas, respondido_por, respondido_por_nome, respondido_por_email, latitude, longitude, endereco)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [qrcodeId, qrcodeNome, JSON.stringify(identificacao || {}), JSON.stringify(respostas || {}), req.user!.id, req.user!.nome, req.user!.email, latitude, longitude, endereco]
  );
  await query(`UPDATE qrcodes SET respostas = respostas + 1 WHERE id = $1`, [qrcodeId]);
  res.status(201).json(row);
});

// ── Leituras de QR Code ──

// GET /api/qrcodes/leituras
router.get('/leituras/all', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT l.* FROM leituras_qrcode l
     JOIN usuarios u ON u.id = l.funcionario_id
     WHERE u.condominio_id = ANY($1)
     ORDER BY l.data_hora DESC LIMIT 500`,
    [ids]
  );
  res.json(rows);
});

// POST /api/qrcodes/leituras
router.post('/leituras', async (req: AuthRequest, res: Response) => {
  const { qrConteudo, funcionarioNome, funcionarioEmail, funcionarioCargo, latitude, longitude, endereco } = req.body;
  const row = await queryOne(
    `INSERT INTO leituras_qrcode (qr_conteudo, funcionario_id, funcionario_nome, funcionario_email, funcionario_cargo, latitude, longitude, endereco)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [qrConteudo, req.user!.id, funcionarioNome || req.user!.nome, funcionarioEmail || req.user!.email, funcionarioCargo, latitude, longitude, endereco]
  );

  // Incrementar contador de respostas se for qrcode existente
  await query(
    `UPDATE qrcodes SET respostas = respostas + 1 WHERE id::text = $1 OR nome = $1`,
    [qrConteudo]
  );

  res.status(201).json(row);
});

// ── Controle de Ponto ──

// GET /api/qrcodes/ponto
router.get('/ponto/all', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT p.* FROM controle_ponto p
     JOIN usuarios u ON u.id = p.funcionario_id
     WHERE u.condominio_id = ANY($1)
     ORDER BY p.data_hora DESC LIMIT 500`,
    [ids]
  );
  res.json(rows);
});

// POST /api/qrcodes/ponto
router.post('/ponto', async (req: AuthRequest, res: Response) => {
  const { tipo, funcionarioNome, funcionarioEmail, funcionarioCargo, latitude, longitude, endereco, permanencia } = req.body;
  const row = await queryOne(
    `INSERT INTO controle_ponto (funcionario_id, funcionario_nome, funcionario_email, funcionario_cargo, tipo, latitude, longitude, endereco, permanencia)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user!.id, funcionarioNome || req.user!.nome, funcionarioEmail || req.user!.email, funcionarioCargo, tipo, latitude, longitude, endereco, permanencia]
  );
  res.status(201).json(row);
});

// ── Registros de Incidentes/Atividades (tabela sla_registros) ──
// Nota: Esta seção usa a tabela sla_registros para rastreamento de ocorrências.
// O SLA de OS (prazos por prioridade) é gerenciado em routes/sla.ts + sla_configuracoes.

// GET /api/qrcodes/sla
router.get('/sla/all', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT * FROM sla_registros WHERE condominio_id = ANY($1) ORDER BY abertura DESC LIMIT 500`,
    [ids]
  );
  res.json(rows);
});

// POST /api/qrcodes/sla
router.post('/sla', async (req: AuthRequest, res: Response) => {
  const { blocoId, categoria, descricao, status } = req.body;
  const row = await queryOne(
    `INSERT INTO sla_registros (bloco_id, categoria, descricao, abertura, status, criado_por)
     VALUES ($1,$2,$3,NOW(),$4,$5) RETURNING *`,
    [blocoId, categoria, descricao || '', status || 'aberto', req.user!.id]
  );
  res.status(201).json(row);
});

// PATCH /api/qrcodes/sla/:id
router.patch('/sla/:id', async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  let sql = '';
  if (status === 'em_atendimento') {
    sql = `UPDATE sla_registros SET status=$1, inicio_atendimento=NOW() WHERE id=$2 RETURNING *`;
  } else if (status === 'resolvido') {
    sql = `UPDATE sla_registros SET status=$1, encerramento=NOW() WHERE id=$2 RETURNING *`;
  } else {
    sql = `UPDATE sla_registros SET status=$1 WHERE id=$2 RETURNING *`;
  }
  const row = await queryOne(sql, [status, req.params.id]);
  res.json(row);
});

// ── Supervisor Permission ──

// GET /api/qrcodes/supervisor-perm
router.get('/supervisor-perm', async (req: AuthRequest, res: Response) => {
  const row = await queryOne(`SELECT valor FROM configuracoes_gerais WHERE chave = 'qrcode_supervisor_autorizado'`);
  res.json({ autorizado: row?.valor === 'true' });
});

// PUT /api/qrcodes/supervisor-perm
router.put('/supervisor-perm', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const { autorizado } = req.body;
  await execute(
    `INSERT INTO configuracoes_gerais (chave, valor) VALUES ('qrcode_supervisor_autorizado', $1)
     ON CONFLICT (chave) DO UPDATE SET valor = $1`,
    [autorizado ? 'true' : 'false']
  );
  res.json({ autorizado });
});

export default router;
