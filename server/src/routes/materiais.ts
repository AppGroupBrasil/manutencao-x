import { Router, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, materialSchema } from '../middleware/validation.js';

const router = Router();

function gerarProtocolo(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `MAT-${y}${m}${d}-${r}`;
}

// GET /api/materiais
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT m.*, c.nome as condominio_nome FROM materiais m
     LEFT JOIN condominios c ON c.id = m.condominio_id
     WHERE m.condominio_id = ANY($1) ORDER BY m.nome`,
    [ids]
  );
  res.json(rows);
});

// POST /api/materiais
router.post('/', validate(materialSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { nome, categoria, unidade, quantidade, quantidadeMinima, custoUnitario, condominioId, emailNotificacao } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' });
    return;
  }
  const protocolo = gerarProtocolo();
  const row = await queryOne(
    `INSERT INTO materiais (protocolo, nome, categoria, unidade, quantidade, quantidade_minima, custo_unitario, condominio_id, email_notificacao)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [protocolo, nome, categoria, unidade || 'un', quantidade || 0, quantidadeMinima || 0, custoUnitario || 0, condominioId, emailNotificacao]
  );
  res.status(201).json(row);
});

// PUT /api/materiais/:id
router.put('/:id', validate(materialSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { nome, categoria, unidade, quantidadeMinima, custoUnitario, emailNotificacao } = req.body;
  const row = await queryOne(
    `UPDATE materiais SET nome=$1, categoria=$2, unidade=$3, quantidade_minima=$4, custo_unitario=$5, email_notificacao=$6
     WHERE id=$7 AND condominio_id = ANY($8) RETURNING *`,
    [nome, categoria, unidade, quantidadeMinima, custoUnitario, emailNotificacao, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Material não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/materiais/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM materiais WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Material não encontrado' }); return; }
  res.json({ ok: true });
});

// ── Movimentações ──

// GET /api/materiais/:id/movimentacoes
router.get('/:id/movimentacoes', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT mm.* FROM materiais_movimentacoes mm
     JOIN materiais m ON m.id = mm.material_id
     WHERE mm.material_id = $1 AND m.condominio_id = ANY($2) ORDER BY mm.data DESC`,
    [req.params.id, ids]
  );
  res.json(rows);
});

// POST /api/materiais/:id/movimentacoes
router.post('/:id/movimentacoes', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { tipo, quantidade, observacao, fotos, notaFiscalUrl, audioUrl, funcionarioNome } = req.body;
  const materialId = req.params.id;

  // Verify material belongs to user scope
  const mat = await queryOne('SELECT id, quantidade FROM materiais WHERE id = $1 AND condominio_id = ANY($2)', [materialId, ids]);
  if (!mat) { res.status(404).json({ error: 'Material não encontrado' }); return; }

  if (tipo === 'saida' && mat.quantidade < quantidade) {
    res.status(400).json({ error: 'Estoque insuficiente' });
    return;
  }

  const row = await transaction(async (client) => {
    // Atualizar quantidade do material
    const op = tipo === 'entrada' ? '+' : '-';
    await client.query(
      `UPDATE materiais SET quantidade = quantidade ${op} $1 WHERE id = $2`,
      [quantidade, materialId]
    );

    const { rows } = await client.query(
      `INSERT INTO materiais_movimentacoes (material_id, tipo, quantidade, observacao, fotos, nota_fiscal_url, audio_url, funcionario_id, funcionario_nome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [materialId, tipo, quantidade, observacao, fotos || [], notaFiscalUrl, audioUrl, req.user!.id, funcionarioNome || req.user!.nome]
    );
    return rows[0];
  });
  res.status(201).json(row);
});

export default router;
