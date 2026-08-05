import { Router, Response } from 'express';
import { query, queryOne, execute, paginate } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validate, ordemServicoSchema, ordemServicoStatusSchema, ordemServicoAvaliacaoSchema, ordemServicoUpdateSchema,
  osResponsaveisSchema, osDescricaoSchema, osFotosSchema } from '../middleware/validation.js';
import { requireMinRole } from '../middleware/rbac.js';
import { createNotification, auditLog } from '../middleware/helpers.js';
import { sendPush } from '../services/push.js';
import { sendEmail, emailOSCriada } from '../services/email.js';
import { notificarGestoresOSCriada, notificarGestoresOSStatus } from '../services/notificacoesOS.js';
import {
  AutorOS, adicionarDescricao, adicionarFotos, definirResponsaveis, detalhesColaboracao,
  listarCandidatos, listarHistorico, registrarHistorico, removerFoto, urlsDosAnexosDaOS,
} from '../services/osColaboracao.js';
import { removerArquivosUpload } from '../services/arquivos.js';

async function enviarEmailsOS(protocolo: string, titulo: string, prioridade: string, condominioId: string, criadorId: string, jaEnviados: string[] = []) {
  const cond = await queryOne<{ nome: string }>('SELECT nome FROM condominios WHERE id = $1', [condominioId]);
  const emails = new Set<string>();
  const add = (rows: Array<{ email: string | null }>) => rows.forEach(r => { if (r.email) emails.add(r.email); });
  add(await query<{ email: string }>(
    `SELECT email FROM usuarios WHERE condominio_id = $1 AND role IN ('administrador','supervisor') AND id <> $2 AND notificar_os_email = true AND ativo = true AND bloqueado = false AND email IS NOT NULL AND email <> ''`,
    [condominioId, criadorId]
  ));
  add(await query<{ email: string }>(
    `SELECT email FROM moradores WHERE condominio_id = $1 AND email IS NOT NULL AND email <> ''`,
    [condominioId]
  ));
  add(await query<{ email: string }>(
    `SELECT email FROM usuarios WHERE condominio_id = $1 AND role = 'funcionario' AND notificar_os_email = true AND ativo = true AND bloqueado = false AND email IS NOT NULL AND email <> ''`,
    [condominioId]
  ));
  jaEnviados.forEach(e => emails.delete(e));
  if (emails.size === 0) return;
  const opts = emailOSCriada(protocolo, titulo, cond?.nome || '', prioridade);
  await sendEmail({ ...opts, bcc: [...emails] });
}

const router = Router();

function gerarProtocolo(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `OS-${y}${m}${d}-${r}`;
}

async function notificarFuncionariosAuto(osId: string, titulo: string, condominioId: string, autorId?: string, excluirIds: string[] = []) {
  const cond = await queryOne<any>('SELECT os_auto_notificar FROM condominios WHERE id = $1', [condominioId]);
  if (!cond?.os_auto_notificar) return;
  const funcionarios = await query<{ id: string; notificar_os_push: boolean }>(
    `SELECT id, notificar_os_push FROM usuarios
       WHERE condominio_id = $1 AND ativo = true AND bloqueado = false
         AND role <> 'master' AND ($2::uuid IS NULL OR id <> $2::uuid)
         AND NOT (id = ANY($3::uuid[]))`,
    [condominioId, autorId ?? null, excluirIds]
  );
  for (const f of funcionarios) {
    await createNotification(f.id, 'Nova Ordem de Serviço', titulo, 'info', `/x/os/${osId}`).catch(() => {});
    if (f.notificar_os_push) {
      await sendPush(f.id, { title: 'Nova Ordem de Serviço', body: titulo, url: `/x/os/${osId}` }).catch(() => {});
    }
  }
}

async function validarReferencias(req: AuthRequest, condominioId: string): Promise<string | null> {
  const { responsavelId, supervisorId, equipamentoId, fornecedorId, planoId } = req.body;
  for (const userId of [responsavelId, supervisorId]) {
    if (!userId || userId === req.user!.id) continue;
    const alvo = await queryOne<any>(
      'SELECT condominio_id, administrador_id, supervisor_id FROM usuarios WHERE id = $1 AND ativo = true',
      [userId]
    );
    const ok = alvo && (
      req.user!.role === 'master' ||
      (alvo.condominio_id && req.condominioIds!.includes(alvo.condominio_id)) ||
      alvo.administrador_id === req.user!.id ||
      alvo.supervisor_id === req.user!.id
    );
    if (!ok) return 'Responsável ou supervisor fora do seu escopo';
  }
  const refs: Array<[string | null | undefined, string, string]> = [
    [equipamentoId, 'equipamentos', 'Equipamento'],
    [fornecedorId, 'fornecedores', 'Fornecedor'],
    [planoId, 'planos_manutencao', 'Plano'],
  ];
  for (const [refId, tabela, rotulo] of refs) {
    if (!refId) continue;
    const row = await queryOne(`SELECT 1 FROM ${tabela} WHERE id = $1 AND condominio_id = $2`, [refId, condominioId]);
    if (!row) return `${rotulo} não pertence a este condomínio`;
  }
  return null;
}

function autorDe(req: AuthRequest): AutorOS {
  return { id: req.user!.id, nome: req.user!.nome, origem: 'painel' };
}

async function carregarOS(req: AuthRequest): Promise<{ id: string; condominio_id: string; protocolo: string; titulo: string } | null> {
  return queryOne(
    'SELECT id, condominio_id, protocolo, titulo FROM ordens_servico WHERE id = $1 AND condominio_id = ANY($2)',
    [req.params.id, req.condominioIds!]
  );
}

const SELECT_RESPONSAVEIS = `
  COALESCE((
    SELECT json_agg(json_build_object('id', r.id, 'usuarioId', r.usuario_id, 'nome', r.nome, 'papel', r.papel) ORDER BY r.criado_em)
      FROM os_responsaveis r WHERE r.os_id = os.id
  ), '[]'::json) AS responsaveis`;

// GET /api/ordens-servico
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) { res.json({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }); return; }
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const result = await paginate(
    `SELECT os.*, c.nome as condominio_nome, u.nome as responsavel_nome, ${SELECT_RESPONSAVEIS}
     FROM ordens_servico os
     LEFT JOIN condominios c ON c.id = os.condominio_id
     LEFT JOIN usuarios u ON u.id = os.responsavel_id
     WHERE os.condominio_id = ANY($1)
     ORDER BY os.data_abertura DESC`,
    [ids], page, pageSize
  );
  res.json(result);
});

// GET /api/ordens-servico/candidatos?condominioId=
router.get('/candidatos', async (req: AuthRequest, res: Response) => {
  const condominioId = String(req.query.condominioId || '');
  if (!req.condominioIds!.includes(condominioId)) {
    res.status(403).json({ error: 'Condomínio fora do escopo' });
    return;
  }
  res.json(await listarCandidatos(condominioId));
});

// GET /api/ordens-servico/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const row = await queryOne(
    `SELECT os.*, c.nome as condominio_nome, u.nome as criado_por_nome FROM ordens_servico os
     LEFT JOIN condominios c ON c.id = os.condominio_id
     LEFT JOIN usuarios u ON u.id = os.criado_por
     WHERE os.id = $1`,
    [req.params.id]
  );
  if (!row || !ids.includes((row as any).condominio_id)) {
    res.status(404).json({ error: 'OS não encontrada' });
    return;
  }
  const detalhes = await detalhesColaboracao(req.params.id);
  res.json({ ...row, ...detalhes });
});

// GET /api/ordens-servico/:id/candidatos — gestores, síndico e funcionários elegíveis
router.get('/:id/candidatos', async (req: AuthRequest, res: Response) => {
  const os = await carregarOS(req);
  if (!os) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  res.json(await listarCandidatos(os.condominio_id));
});

// GET /api/ordens-servico/:id/historico
router.get('/:id/historico', async (req: AuthRequest, res: Response) => {
  const os = await carregarOS(req);
  if (!os) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  res.json(await listarHistorico(req.params.id));
});

// PUT /api/ordens-servico/:id/responsaveis
router.put('/:id/responsaveis', validate(osResponsaveisSchema), async (req: AuthRequest, res: Response) => {
  const os = await carregarOS(req);
  if (!os) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  const resultado = await definirResponsaveis(req.params.id, os.condominio_id, req.body.responsaveis, autorDe(req));
  if ('erro' in resultado) { res.status(400).json({ error: resultado.erro }); return; }
  res.json(resultado);
});

// POST /api/ordens-servico/:id/descricoes
router.post('/:id/descricoes', validate(osDescricaoSchema), async (req: AuthRequest, res: Response) => {
  const os = await carregarOS(req);
  if (!os) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  const resultado = await adicionarDescricao(req.params.id, req.body.texto, autorDe(req));
  if ('erro' in resultado) { res.status(400).json({ error: resultado.erro }); return; }
  res.status(201).json(resultado);
});

// POST /api/ordens-servico/:id/fotos
router.post('/:id/fotos', validate(osFotosSchema), async (req: AuthRequest, res: Response) => {
  const os = await carregarOS(req);
  if (!os) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  const resultado = await adicionarFotos(req.params.id, req.body.fotos, autorDe(req));
  if ('erro' in resultado) { res.status(400).json({ error: resultado.erro }); return; }
  res.status(201).json(resultado);
});

// DELETE /api/ordens-servico/:id/fotos/:fotoId
router.delete('/:id/fotos/:fotoId', async (req: AuthRequest, res: Response) => {
  const os = await carregarOS(req);
  if (!os) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  const resultado = await removerFoto(req.params.id, req.params.fotoId, autorDe(req));
  if ('erro' in resultado) { res.status(404).json({ error: resultado.erro }); return; }
  res.json(resultado);
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
  const erroRef = await validarReferencias(req, condominioId);
  if (erroRef) { res.status(403).json({ error: erroRef }); return; }
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
  const autor = autorDe(req);
  const listaResp: Array<{ usuarioId?: string | null; nome?: string | null }> = Array.isArray(req.body.responsaveis)
    ? req.body.responsaveis
    : (responsavelId ? [{ usuarioId: responsavelId }] : []);
  let responsaveis: unknown[] = [];
  if (listaResp.length > 0) {
    const resultado = await definirResponsaveis(String(row.id), condominioId, listaResp, autor)
      .catch((err) => ({ erro: String(err?.message || 'falha ao definir responsáveis') }));
    if ('erro' in resultado) console.warn(`[OS] Responsáveis não aplicados em ${row.id}: ${resultado.erro}`);
    else responsaveis = resultado.responsaveis;
  }
  if (descricao && String(descricao).trim()) {
    await registrarHistorico(String(row.id), 'descricao', String(descricao).trim().slice(0, 5000), { inicial: true }, autor).catch(() => {});
  }
  const osCriada = row;
  notificarGestoresOSCriada(
    { id: String(osCriada.id), protocolo: String(osCriada.protocolo), titulo, condominioId, prioridade: prioridade || 'media' },
    req.user!.id
  )
    .catch(() => ({ ids: [], emails: [] }))
    .then(async (gestores) => {
      await notificarFuncionariosAuto(String(osCriada.id), titulo, condominioId, req.user!.id, gestores.ids).catch(() => {});
      await enviarEmailsOS(String(osCriada.protocolo), titulo, prioridade || 'media', condominioId, req.user!.id, gestores.emails)
        .catch((err) => console.error('[OS] Erro ao enviar e-mails:', err?.message));
    })
    .catch(() => {});
  res.status(201).json({ ...row, responsaveis });
});

// PATCH /api/ordens-servico/:id/status
router.patch('/:id/status', validate(ordemServicoStatusSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const { status } = req.body;
  if (status === 'cancelada' && req.user!.role === 'funcionario') {
    res.status(403).json({ error: 'Sem permissão para cancelar OS' });
    return;
  }
  const extra = status === 'concluida' ? ', data_conclusao = NOW()' : ', data_conclusao = NULL';
  const anterior = await queryOne<{ status: string }>(
    'SELECT status FROM ordens_servico WHERE id = $1 AND condominio_id = ANY($2)',
    [req.params.id, ids]
  );
  const row = await queryOne(
    `UPDATE ordens_servico SET status = $1 ${extra} WHERE id = $2 AND condominio_id = ANY($3) RETURNING *`,
    [status, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  registrarHistorico(req.params.id, 'status', `Status alterado para ${status}`, { para: status }, autorDe(req)).catch(() => {});
  notificarGestoresOSStatus(
    { id: String(row.id), protocolo: String(row.protocolo), titulo: String(row.titulo), condominioId: String(row.condominio_id) },
    anterior?.status || 'aberta',
    status,
    req.user!.id
  ).catch(() => {});
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
  observacoes: 'observacoes', dataPrevisao: 'data_previsao',
  equipamentoId: 'equipamento_id', fornecedorId: 'fornecedor_id', planoId: 'plano_id',
  custoMaterial: 'custo_material', custoMaoObra: 'custo_mao_obra', custoExterno: 'custo_terceiros',
};

export function camposAlterados(antes: Record<string, any>, depois: Record<string, any>, colunas: Record<string, string>) {
  const mudancas: Record<string, { de: unknown; para: unknown }> = {};
  for (const coluna of Object.values(colunas)) {
    const de = antes?.[coluna] ?? null;
    const para = depois?.[coluna] ?? null;
    const iguais = de instanceof Date && para instanceof Date
      ? de.getTime() === para.getTime()
      : String(de) === String(para);
    if (!iguais) mudancas[coluna] = { de, para };
  }
  return mudancas;
}

router.put('/:id', validate(ordemServicoUpdateSchema), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const antes = await queryOne<any>(
    'SELECT * FROM ordens_servico WHERE id = $1 AND condominio_id = ANY($2)',
    [req.params.id, ids]
  );
  if (!antes) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  const erroRef = await validarReferencias(req, antes.condominio_id);
  if (erroRef) { res.status(403).json({ error: erroRef }); return; }
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const [campo, coluna] of Object.entries(COLUNAS_OS)) {
    if (req.body[campo] !== undefined) { fields.push(`${coluna} = $${idx++}`); values.push(req.body[campo]); }
  }
  if (fields.length === 0) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return; }
  values.push(req.params.id, ids);
  const row = await queryOne<any>(
    `UPDATE ordens_servico SET ${fields.join(', ')} WHERE id = $${idx++} AND condominio_id = ANY($${idx}) RETURNING *`,
    values
  );
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  const mudancas = camposAlterados(antes, row, COLUNAS_OS);
  if (Object.keys(mudancas).length > 0) {
    await registrarHistorico(req.params.id, 'edicao', Object.keys(mudancas).join(', '), { mudancas }, autorDe(req)).catch(() => {});
  }
  await auditLog(req.user!, 'os_atualizada', 'ordens_servico', req.params.id, { campos: Object.keys(req.body) }).catch(() => {});
  res.json({ ...row, ...(await detalhesColaboracao(req.params.id)) });
});

// DELETE /api/ordens-servico/:id — apenas master ou o gestor titular que cadastrou o condomínio
router.delete('/:id', requireMinRole('administrador'), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  const os = await queryOne<{ condominio_id: string }>(
    'SELECT condominio_id FROM ordens_servico WHERE id = $1 AND condominio_id = ANY($2)',
    [req.params.id, ids]
  );
  if (!os) { res.status(404).json({ error: 'OS não encontrada' }); return; }

  if (req.user!.role !== 'master') {
    const cond = await queryOne<{ criado_por: string }>(
      'SELECT criado_por FROM condominios WHERE id = $1',
      [os.condominio_id]
    );
    if (req.user!.administrador_id || cond?.criado_por !== req.user!.id) {
      res.status(403).json({ error: 'Somente o gestor principal que cadastrou o condomínio pode excluir ordens de serviço' });
      return;
    }
  }

  const anexos = await urlsDosAnexosDaOS(req.params.id).catch(() => [] as string[]);
  const row = await queryOne<{ id: string; protocolo: string; titulo: string }>(
    'DELETE FROM ordens_servico WHERE id = $1 AND condominio_id = ANY($2) RETURNING id, protocolo, titulo',
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'OS não encontrada' }); return; }
  await removerArquivosUpload(anexos).catch(() => {});
  await auditLog(req.user!, 'os_excluida', 'ordens_servico', req.params.id, { protocolo: row.protocolo, titulo: row.titulo }).catch(() => {});
  res.json({ ok: true });
});

export default router;
