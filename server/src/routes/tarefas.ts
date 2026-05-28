import { Router, Response } from 'express';
import { query, queryOne, execute, transaction } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, tarefaSchema } from '../middleware/validation.js';

const router = Router();

// ── Tarefas Agendadas ──

// GET /api/tarefas
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT t.*, c.nome as condominio_nome FROM tarefas_agendadas t
     LEFT JOIN condominios c ON c.id = t.condominio_id
     WHERE t.condominio_id = ANY($1) ORDER BY t.criado_em DESC`,
    [ids]
  );
  res.json(rows);
});

// POST /api/tarefas
router.post('/', validate(tarefaSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { titulo, descricao, funcionarioId, funcionarioNome, condominioId, bloco, local, recorrencia, diasSemana, dataEspecifica, diaMes, prioridade } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso' });
    return;
  }
  const row = await queryOne(
    `INSERT INTO tarefas_agendadas (titulo, descricao, funcionario_id, funcionario_nome, condominio_id, bloco, local, recorrencia, dias_semana, data_especifica, dia_mes, criado_por, prioridade)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [titulo, descricao, funcionarioId, funcionarioNome, condominioId, bloco, local, recorrencia || 'unica', diasSemana || [], dataEspecifica, diaMes, req.user!.id, prioridade || 'media']
  );
  res.status(201).json(row);
});

// PUT /api/tarefas/:id
router.put('/:id', validate(tarefaSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { titulo, descricao, funcionarioId, funcionarioNome, bloco, local, recorrencia, diasSemana, dataEspecifica, diaMes, prioridade } = req.body;
  const row = await queryOne(
    `UPDATE tarefas_agendadas SET titulo=$1, descricao=$2, funcionario_id=$3, funcionario_nome=$4, bloco=$5, local=$6, recorrencia=$7, dias_semana=$8, data_especifica=$9, dia_mes=$10, prioridade=$11
     WHERE id=$12 AND condominio_id = ANY($13) RETURNING *`,
    [titulo, descricao, funcionarioId, funcionarioNome, bloco, local, recorrencia, diasSemana, dataEspecifica, diaMes, prioridade, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Tarefa não encontrada' }); return; }
  res.json(row);
});

// DELETE /api/tarefas/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne('DELETE FROM tarefas_agendadas WHERE id = $1 AND condominio_id = ANY($2) RETURNING id', [req.params.id, ids]);
  if (!row) { res.status(404).json({ error: 'Tarefa não encontrada' }); return; }
  res.json({ ok: true });
});

// ── Execuções de Tarefas ──

// GET /api/tarefas/:id/execucoes
router.get('/:id/execucoes', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const rows = await query(
    `SELECT te.* FROM tarefas_execucoes te
     JOIN tarefas_agendadas ta ON ta.id = te.tarefa_id
     WHERE te.tarefa_id = $1 AND ta.condominio_id = ANY($2) ORDER BY te.data_execucao DESC`,
    [req.params.id, ids]
  );
  res.json(rows);
});

// GET /api/tarefas/execucoes/all
router.get('/execucoes/all', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json([]); return; }
  const rows = await query(
    `SELECT te.*, ta.titulo as tarefa_titulo, ta.condominio_id
     FROM tarefas_execucoes te
     JOIN tarefas_agendadas ta ON ta.id = te.tarefa_id
     WHERE ta.condominio_id = ANY($1)
     ORDER BY te.data_execucao DESC`,
    [ids]
  );
  res.json(rows);
});

// POST /api/tarefas/:id/execucoes
router.post('/:id/execucoes', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  // Verify tarefa belongs to user scope
  const tarefa = await queryOne('SELECT id FROM tarefas_agendadas WHERE id = $1 AND condominio_id = ANY($2)', [req.params.id, ids]);
  if (!tarefa) { res.status(404).json({ error: 'Tarefa não encontrada' }); return; }
  const { funcionarioNome, status, fotos, observacao, latitude, longitude, audioUrl } = req.body;
  
  const row = await transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO tarefas_execucoes (tarefa_id, funcionario_id, funcionario_nome, status, fotos, observacao, latitude, longitude, audio_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, req.user!.id, funcionarioNome || req.user!.nome, status || 'concluida', fotos || [], observacao, latitude, longitude, audioUrl]
    );
    
    if (status === 'concluida') {
        await client.query(
          `UPDATE tarefas_agendadas SET atualizado_em = NOW() WHERE id = $1`,
          [req.params.id]
        );
    }
    return rows[0];
  });
  
  res.status(201).json(row);
});

export default router;
