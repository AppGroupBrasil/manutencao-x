import { Router, Response } from 'express';
import { query, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, escalaSchema } from '../middleware/validation.js';

const router = Router();

// GET /api/escalas
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT e.*, c.nome as condominio_nome, u.nome as funcionario_nome_real
     FROM escalas e
     LEFT JOIN condominios c ON c.id = e.condominio_id
     LEFT JOIN usuarios u ON u.id = e.funcionario_id
     WHERE e.condominio_id = ANY($1) AND e.ativo = true
     ORDER BY e.dia_semana, e.hora_inicio`,
    [ids]
  );
  res.json(rows);
});

// POST /api/escalas
router.post('/', validate(escalaSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { condominioId, funcionarioId, funcionarioNome, diaSemana, horaInicio, horaFim, local, funcao, observacoes } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso a este condomínio' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO escalas (condominio_id, funcionario_id, funcionario_nome, dia_semana, hora_inicio, hora_fim, local, funcao, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [condominioId, funcionarioId, funcionarioNome, diaSemana, horaInicio, horaFim, local, funcao, observacoes]
  );
  res.status(201).json(row);
});

// PUT /api/escalas/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { funcionarioId, funcionarioNome, diaSemana, horaInicio, horaFim, local, funcao, observacoes } = req.body;
  const row = await queryOne(
    `UPDATE escalas SET funcionario_id=$1, funcionario_nome=$2, dia_semana=$3, hora_inicio=$4, hora_fim=$5, local=$6, funcao=$7, observacoes=$8
     WHERE id=$9 AND condominio_id = ANY($10) RETURNING *`,
    [funcionarioId, funcionarioNome, diaSemana, horaInicio, horaFim, local, funcao, observacoes, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Escala não encontrada' }); return; }
  res.json(row);
});

// DELETE /api/escalas/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const row = await queryOne('UPDATE escalas SET ativo = false WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Escala não encontrada' }); return; }
  res.json({ ok: true });
});

export default router;
