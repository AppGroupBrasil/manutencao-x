import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { requireMinRole, requireRole } from '../middleware/rbac.js';
import { auditLog } from '../middleware/helpers.js';
import { validate, condominioSchema, condominioStatusSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/condominios
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }
  const isMaster = req.user?.role === 'master';
  const rows = await query(
    isMaster
      ? `SELECT c.*, u.nome AS administrador_nome FROM condominios c LEFT JOIN usuarios u ON c.criado_por = u.id WHERE c.id = ANY($1) ORDER BY c.nome`
      : `SELECT * FROM condominios WHERE id = ANY($1) AND ativo = true ORDER BY nome`,
    [ids]
  );
  res.json(rows);
});

// GET /api/condominios/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (!ids.includes(req.params.id)) {
    res.status(404).json({ error: 'Condomínio não encontrado' });
    return;
  }
  const isMaster = req.user?.role === 'master';
  const row = await queryOne(
    isMaster
      ? 'SELECT c.*, u.nome AS administrador_nome FROM condominios c LEFT JOIN usuarios u ON c.criado_por = u.id WHERE c.id = $1'
      : 'SELECT * FROM condominios WHERE id = $1 AND ativo = true',
    [req.params.id]
  );
  if (!row) {
    res.status(404).json({ error: 'Condomínio não encontrado' });
    return;
  }
  res.json(row);
});

// POST /api/condominios
router.post('/', requireMinRole('administrador'), validate(condominioSchema), async (req: AuthRequest, res: Response) => {
  const { nome, endereco, cidade, estado, cep, cnpj, sindico, telefone, email, blocos, unidades } = req.body;
  const row = await queryOne(
    `INSERT INTO condominios (nome, endereco, cidade, estado, cep, cnpj, sindico, telefone, email, blocos, unidades, criado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [nome, endereco, cidade, estado, cep, cnpj || null, sindico, telefone, email, blocos || 0, unidades || 0, req.user!.id]
  );
  res.status(201).json(row);
});

// PUT /api/condominios/:id
router.put('/:id', requireMinRole('administrador'), validate(condominioSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (!ids.includes(req.params.id)) {
    res.status(403).json({ error: 'Sem acesso a este condomínio' });
    return;
  }
  const { nome, endereco, cidade, estado, cep, cnpj, sindico, telefone, email, blocos, unidades } = req.body;
  const row = await queryOne(
    `UPDATE condominios SET nome=$1, endereco=$2, cidade=$3, estado=$4, cep=$5, cnpj=$6,
     sindico=$7, telefone=$8, email=$9, blocos=$10, unidades=$11
     WHERE id=$12 RETURNING *`,
    [nome, endereco, cidade, estado, cep, cnpj || null, sindico, telefone, email, blocos, unidades, req.params.id]
  );
  res.json(row);
});

// PATCH /api/condominios/:id/status — Master gerencia plano e status
router.patch('/:id/status', requireRole('master'), validate(condominioStatusSchema), async (req: AuthRequest, res: Response) => {
  const { plano, status_plano, ativo, data_fim_teste, valor_mensalidade } = req.body;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (plano !== undefined) { fields.push(`plano = $${idx++}`); values.push(plano); }
  if (status_plano !== undefined) { fields.push(`status_plano = $${idx++}`); values.push(status_plano); }
  if (ativo !== undefined) { fields.push(`ativo = $${idx++}`); values.push(ativo); }
  if (data_fim_teste !== undefined) { fields.push(`data_fim_teste = $${idx++}`); values.push(data_fim_teste); }
  if (valor_mensalidade !== undefined) { fields.push(`valor_mensalidade = $${idx++}`); values.push(valor_mensalidade); }

  if (fields.length === 0) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return; }

  values.push(req.params.id);
  const row = await queryOne(
    `UPDATE condominios SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (!row) { res.status(404).json({ error: 'Condomínio não encontrado' }); return; }
  await auditLog(req.user!, 'condominio_status_alterado', 'condominios', req.params.id, { plano, status_plano, ativo });
  res.json(row);
});

// DELETE /api/condominios/:id
router.delete('/:id', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (!ids.includes(req.params.id)) {
    res.status(403).json({ error: 'Sem acesso a este condomínio' });
    return;
  }
  await execute('UPDATE condominios SET ativo = false WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
