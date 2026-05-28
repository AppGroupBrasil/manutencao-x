import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, roteiroSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/roteiros
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT r.* FROM roteiros r
     WHERE r.condominio_id IS NULL OR r.condominio_id = ANY($1)
     ORDER BY r.criado_em DESC`,
    [ids]
  );
  res.json(rows);
});

// GET /api/roteiros/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('SELECT * FROM roteiros WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2))', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Roteiro não encontrado' }); return; }
  res.json(row);
});

// POST /api/roteiros
router.post('/', validate(roteiroSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { titulo, descricao, categoria, capa, passos, condominioId } = req.body;
  if (condominioId && !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' }); return;
  }
  const row = await queryOne(
    `INSERT INTO roteiros (titulo, descricao, categoria, capa, passos, condominio_id, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [titulo, descricao, categoria, capa, JSON.stringify(passos || []), condominioId, req.user!.id]
  );
  res.status(201).json(row);
});

// PUT /api/roteiros/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { titulo, descricao, categoria, capa, passos } = req.body;
  const row = await queryOne(
    `UPDATE roteiros SET titulo=$1, descricao=$2, categoria=$3, capa=$4, passos=$5
     WHERE id=$6 AND (condominio_id IS NULL OR condominio_id = ANY($7)) RETURNING *`,
    [titulo, descricao, categoria, capa, JSON.stringify(passos), req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Roteiro não encontrado' }); return; }
  res.json(row);
});

// DELETE /api/roteiros/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM roteiros WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2)) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Roteiro não encontrado' }); return; }
  res.json({ ok: true });
});

// ── Execuções de Roteiros ──

// GET /api/roteiros/:id/execucoes
router.get('/:id/execucoes', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT re.* FROM roteiros_execucoes_log re
     JOIN roteiros r ON r.id = re.roteiro_id
     WHERE re.roteiro_id = $1 AND (r.condominio_id IS NULL OR r.condominio_id = ANY($2))
     ORDER BY re.data DESC`,
    [req.params.id, ids]
  );
  res.json(rows);
});

// POST /api/roteiros/:id/execucoes
router.post('/:id/execucoes', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const roteiro = await queryOne('SELECT id FROM roteiros WHERE id = $1 AND (condominio_id IS NULL OR condominio_id = ANY($2))', [req.params.id, ids]);
  if (!roteiro) { res.status(404).json({ error: 'Roteiro não encontrado' }); return; }
  const { funcionarioNome, passosExec } = req.body;
  const row = await queryOne(
    `INSERT INTO roteiros_execucoes_log (roteiro_id, funcionario_id, funcionario_nome, passos_exec)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, req.user!.id, funcionarioNome || req.user!.nome, JSON.stringify(passosExec || [])]
  );
  res.status(201).json(row);
});

export default router;
