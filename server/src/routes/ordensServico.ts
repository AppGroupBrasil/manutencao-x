import { Router, Response } from 'express';
import { query, queryOne, execute, paginate } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, ordemServicoSchema, ordemServicoStatusSchema, ordemServicoAvaliacaoSchema, ordemServicoUpdateSchema } from '../middleware/validation.js';
import { requireMinRole } from '../middleware/rbac.js';
import { createNotification, auditLog } from '../middleware/helpers.js';
import { sendPush } from '../services/push.js';

const router = Router();

function gerarProtocolo(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `OS-${y}${m}${d}-${r}`;
}

async function notificarFuncionariosAuto(osId: string, titulo: string, condominioId: string) {
  const cond = await queryOne<any>('SELECT os_auto_notificar FROM condominios WHERE id = $1', [condominioId]);
  if (!cond?.os_auto_notificar) return;
  const funcionarios = await query<{ id: string }>(
    `SELECT id FROM usuarios WHERE condominio_id = $1 AND role = 'funcionario' AND ativo = true AND bloqueado = false`,
    [condominioId]
  );
  for (const f of funcionarios) {
    await createNotification(f.id, 'Nova Ordem de Serviço', titulo, 'info', `/x/os/${osId}`).catch(() => {});
    await sendPush(f.id, { title: 'Nova Ordem de Serviço', body: titulo, url: `/x/os/${osId}` }).catch(() => {});
  }
}

// GET /api/ordens-servico
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }); return; }
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const result = await paginate(
    `SELECT os.*, c.nome as condominio_nome, u.nome as responsavel_nome
     FROM ordens_servico os
     LEFT JOIN condominios c ON c.id = os.condominio_id
     LEFT JOIN usuarios u ON u.id = os.responsavel_id
     WHERE os.condominio_id = ANY($1)
     ORDER BY os.data_abertura DESC`,
    [ids], page, pageSize
  );
  res.json(result);
});

// GET /api/ordens-servico/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne(
    `SELECT os.*, c.nome as condominio_nome FROM ordens_servico os
     LEFT JOIN condominios c ON c.id = os.condominio_id
     WHERE os.id = $1`,
    [req.params.id]
  );
  if (!row || !ids.includes((row as any).condominio_id)) {
    res.status(404).json({ error: 'OS não encontrada' });
    return;
  }
  res.json(row);
});

// POST /api/ordens-servico
router.post('/', requireMinRole('supervisor'), validate(ordemServicoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { condominioId, titulo, descricao, tipo, prioridade, local, responsavelId, supervisorId,
    equipamentoId, fornecedorId, planoId, custoMaterial, custoMaoObra, custoExterno, dataPrevisao } = req.body;
  if (!condominioId || !ids.includes(condominioId)) {
    res.status(403).json({ error: 'Sem acesso a este condomínio' });
    return;
  }
  let row: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const protocolo = gerarProtocolo();
    try {
      row = await queryOne(
        `INSERT INTO ordens_servico (protocolo, condominio_id, titulo, descricao, tipo, prioridade, local, responsavel_id, supervisor_id,
           equipamento_id, fornecedor_id, plano_id, custo_material, custo_mao_obra, custo_terceiros, data_previsao, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [protocolo, condominioId, titulo, descricao, tipo || 'limpeza', prioridade || 'media', local, responsavelId, supervisorId,
          equipamentoId ?? null, fornecedorId ?? null, planoId ?? null, custoMaterial ?? 0, custoMaoObra ?? 0, custoExterno ?? 0, dataPrevisao, req.user!.id]
      );
      break;
    } catch (err: any) {
      if (err.code !== '23505') throw err;
    }
  }
  if (!row) { res.status(500).json({ error: 'Não foi possível gerar protocolo único' }); return; }
  notificarFuncionariosAuto(String(row.id), titulo, condominioId).catch(() => {});
  res.status(201).json(row);
});

// PATCH /api/ordens-servico/:id/status
router.patch('/:id/status', validate(ordemServicoStatusSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { status } = req.body;
  const extra = status === 'concluida' ? ', data_conclusao = NOW()' : '';
  const row = await queryOne(
    `UPDATE ordens_servico SET status = $1 ${extra} WHERE id = $2 AND condominio_id = ANY($3) RETURNING *`,
    [status, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  res.json(row);
});

// PATCH /api/ordens-servico/:id/avaliacao
router.patch('/:id/avaliacao', validate(ordemServicoAvaliacaoSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { nota, comentario } = req.body;
  const row = await queryOne(
    `UPDATE ordens_servico SET avaliacao_nota = $1, avaliacao_comentario = $2 WHERE id = $3 AND condominio_id = ANY($4) RETURNING *`,
    [nota, comentario, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  res.json(row);
});

// PUT /api/ordens-servico/:id
const COLUNAS_OS: Record<string, string> = {
  titulo: 'titulo', descricao: 'descricao', tipo: 'tipo', prioridade: 'prioridade',
  local: 'local', responsavelId: 'responsavel_id', supervisorId: 'supervisor_id',
  observacoes: 'observacoes', fotos: 'fotos', dataPrevisao: 'data_previsao',
  equipamentoId: 'equipamento_id', fornecedorId: 'fornecedor_id', planoId: 'plano_id',
  custoMaterial: 'custo_material', custoMaoObra: 'custo_mao_obra', custoExterno: 'custo_terceiros',
};

router.put('/:id', requireMinRole('supervisor'), validate(ordemServicoUpdateSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const [campo, coluna] of Object.entries(COLUNAS_OS)) {
    if (req.body[campo] !== undefined) { fields.push(`${coluna} = $${idx++}`); values.push(req.body[campo]); }
  }
  if (fields.length === 0) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return; }
  values.push(req.params.id, ids);
  const row = await queryOne(
    `UPDATE ordens_servico SET ${fields.join(', ')} WHERE id = $${idx++} AND condominio_id = ANY($${idx}) RETURNING *`,
    values
  );
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  res.json(row);
});

// DELETE /api/ordens-servico/:id
router.delete('/:id', requireMinRole('supervisor'), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne<{ id: string; protocolo: string; titulo: string }>(
    'DELETE FROM ordens_servico WHERE id = $1 AND condominio_id = ANY($2) RETURNING id, protocolo, titulo',
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  await auditLog(req.user!, 'os_excluida', 'ordens_servico', req.params.id, { protocolo: row.protocolo, titulo: row.titulo }).catch(() => {});
  res.json({ ok: true });
});

export default router;
