import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, vencimentoSchema, vencimentoRegistroSchema, vencimentoAnexosSchema } from '../middleware/validation.js';
import { removerArquivoUpload, removerArquivosUpload } from '../services/arquivos.js';

const router = Router();

async function carregarVencimento(req: AuthRequest) {
  return queryOne<{ id: string }>(
    'SELECT id FROM vencimentos WHERE id = $1 AND condominio_id = ANY($2)',
    [req.params.id, req.condominioIds!]
  );
}

function listarAnexos(vencimentoId: string) {
  return query(
    `SELECT id, url, nome, tipo, fase, autor_nome, criado_em
       FROM vencimento_anexos WHERE vencimento_id = $1 ORDER BY criado_em`,
    [vencimentoId]
  );
}

// GET /api/vencimentos
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT v.*, c.nome as condominio_nome,
            (SELECT COUNT(*) FROM vencimento_anexos a WHERE a.vencimento_id = v.id)::int AS total_anexos
     FROM vencimentos v
     LEFT JOIN condominios c ON c.id = v.condominio_id
     WHERE v.condominio_id = ANY($1) ORDER BY v.data_vencimento`,
    [ids]
  );
  res.json(rows);
});

// GET /api/vencimentos/:id/registro
router.get('/:id/registro', async (req: AuthRequest, res: Response) => {
  const venc = await queryOne<{ id: string; registro_descricao: string | null }>(
    'SELECT id, registro_descricao FROM vencimentos WHERE id = $1 AND condominio_id = ANY($2)',
    [req.params.id, req.condominioIds!]
  );
  if (!venc) { res.status(404).json({ error: 'Vencimento não encontrado' }); return; }
  res.json({ descricao: venc.registro_descricao || '', anexos: await listarAnexos(venc.id) });
});

// PUT /api/vencimentos/:id/registro
router.put('/:id/registro', validate(vencimentoRegistroSchema), async (req: AuthRequest, res: Response) => {
  const venc = await carregarVencimento(req);
  if (!venc) { res.status(404).json({ error: 'Vencimento não encontrado' }); return; }
  const descricao = (req.body.descricao ?? '').slice(0, 5000);
  await execute('UPDATE vencimentos SET registro_descricao = $1 WHERE id = $2', [descricao, venc.id]);
  res.json({ descricao, anexos: await listarAnexos(venc.id) });
});

// POST /api/vencimentos/:id/anexos
router.post('/:id/anexos', validate(vencimentoAnexosSchema), async (req: AuthRequest, res: Response) => {
  const venc = await carregarVencimento(req);
  if (!venc) { res.status(404).json({ error: 'Vencimento não encontrado' }); return; }
  const total = await queryOne<{ total: string }>(
    'SELECT COUNT(*) as total FROM vencimento_anexos WHERE vencimento_id = $1', [venc.id]
  );
  const anexos: Array<{ url: string; nome?: string | null; tipo?: string; fase?: string }> = req.body.anexos;
  if (Number(total?.total ?? 0) + anexos.length > 30) {
    res.status(400).json({ error: 'Limite de 30 anexos por vencimento' });
    return;
  }
  for (const item of anexos) {
    const tipo = item.tipo ?? (/\.pdf$/i.test(item.url) ? 'arquivo' : 'imagem');
    const fase = item.fase === 'depois' ? 'depois' : 'antes';
    await execute(
      `INSERT INTO vencimento_anexos (vencimento_id, url, nome, tipo, fase, autor_id, autor_nome)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [venc.id, item.url, item.nome?.slice(0, 255) ?? null, tipo, fase, req.user!.id, req.user!.nome]
    );
  }
  res.status(201).json({ anexos: await listarAnexos(venc.id) });
});

// DELETE /api/vencimentos/:id/anexos/:anexoId
router.delete('/:id/anexos/:anexoId', async (req: AuthRequest, res: Response) => {
  const venc = await carregarVencimento(req);
  if (!venc) { res.status(404).json({ error: 'Vencimento não encontrado' }); return; }
  const row = await queryOne<{ url: string }>(
    'DELETE FROM vencimento_anexos WHERE id = $1 AND vencimento_id = $2 RETURNING url',
    [req.params.anexoId, venc.id]
  );
  if (!row) { res.status(404).json({ error: 'Anexo não encontrado' }); return; }
  await removerArquivoUpload(row.url).catch(() => {});
  res.json({ anexos: await listarAnexos(venc.id) });
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
  const anexos = await query<{ url: string }>(
    'SELECT url FROM vencimento_anexos WHERE vencimento_id = $1', [req.params.id]
  ).catch(() => [] as Array<{ url: string }>);
  const row = await queryOne('DELETE FROM vencimentos WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Vencimento não encontrado' }); return; }
  await removerArquivosUpload(anexos.map(a => a.url)).catch(() => {});
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
