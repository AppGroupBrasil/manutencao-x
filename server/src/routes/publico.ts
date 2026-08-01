import { Router, Request, Response } from 'express';
import multer from 'multer';
import { queryOne, execute } from '../db/database.js';
import { createNotification } from '../middleware/helpers.js';
import { sendPush } from '../services/push.js';
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  bufferMatchesMimeType,
  salvarImagemWebp,
} from '../services/imagens.js';
import {
  AutorOS,
  adicionarDescricao,
  adicionarFotos,
  definirResponsaveis,
  detalhesColaboracao,
  listarCandidatos,
  registrarHistorico,
  removerFoto,
} from '../services/osColaboracao.js';

const router = Router();

const uploadPublico = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de imagem não permitido'));
  },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_OS = ['aberta', 'em_andamento', 'concluida', 'aguardando'];
const STATUS_CHECKLIST = ['pendente', 'em_andamento', 'concluido'];
const STATUS_KANBAN = ['a_fazer', 'em_andamento', 'em_revisao', 'concluido'];

function idValido(id: string): boolean {
  return UUID_RE.test(id);
}

function lerNome(body: any): string | null {
  const nome = String(body?.executadoPor || '').trim();
  if (nome.length < 3 || nome.length > 255) return null;
  return nome;
}

// ─── ORDEM DE SERVIÇO ───

router.get('/os/:id', async (req: Request, res: Response) => {
  if (!idValido(req.params.id)) { res.status(404).json({ error: 'Link inválido' }); return; }
  const row = await queryOne(
    `SELECT os.id, os.protocolo, os.titulo, os.descricao, os.tipo, os.prioridade,
            os.status, os.local, os.fotos, os.observacoes, os.data_abertura,
            os.data_previsao, os.data_conclusao, os.executado_por_nome,
            c.nome as condominio_nome, u.nome as responsavel_nome
     FROM ordens_servico os
     LEFT JOIN condominios c ON c.id = os.condominio_id
     LEFT JOIN usuarios u ON u.id = os.responsavel_id
     WHERE os.id = $1`,
    [req.params.id]
  );
  if (!row) { res.status(404).json({ error: 'Ordem de serviço não encontrada' }); return; }
  res.json({ ...row, ...(await detalhesColaboracao(req.params.id)) });
});

async function carregarOSPublica(id: string) {
  if (!idValido(id)) return null;
  return queryOne<{ id: string; condominio_id: string; status: string; protocolo: string; titulo: string; criado_por: string | null }>(
    'SELECT id, condominio_id, status, protocolo, titulo, criado_por FROM ordens_servico WHERE id = $1',
    [id]
  );
}

function autorPublico(body: any): AutorOS | null {
  const nome = lerNome(body);
  if (!nome) return null;
  return { id: null, nome, origem: 'publico' };
}

router.get('/os/:id/candidatos', async (req: Request, res: Response) => {
  const os = await carregarOSPublica(req.params.id);
  if (!os) { res.status(404).json({ error: 'Ordem de serviço não encontrada' }); return; }
  res.json(await listarCandidatos(os.condominio_id));
});

router.put('/os/:id/responsaveis', async (req: Request, res: Response) => {
  const os = await carregarOSPublica(req.params.id);
  if (!os) { res.status(404).json({ error: 'Ordem de serviço não encontrada' }); return; }
  const autor = autorPublico(req.body);
  if (!autor) { res.status(400).json({ error: 'Informe seu nome (mínimo 3 caracteres)' }); return; }
  const lista = Array.isArray(req.body?.responsaveis) ? req.body.responsaveis : null;
  if (!lista) { res.status(400).json({ error: 'Lista de responsáveis inválida' }); return; }
  const resultado = await definirResponsaveis(os.id, os.condominio_id, lista.slice(0, 20), autor);
  if ('erro' in resultado) { res.status(400).json({ error: resultado.erro }); return; }
  res.json(resultado);
});

router.post('/os/:id/descricoes', async (req: Request, res: Response) => {
  const os = await carregarOSPublica(req.params.id);
  if (!os) { res.status(404).json({ error: 'Ordem de serviço não encontrada' }); return; }
  const autor = autorPublico(req.body);
  if (!autor) { res.status(400).json({ error: 'Informe seu nome (mínimo 3 caracteres)' }); return; }
  const resultado = await adicionarDescricao(os.id, String(req.body?.texto || ''), autor);
  if ('erro' in resultado) { res.status(400).json({ error: resultado.erro }); return; }
  res.status(201).json(resultado);
});

const CAMPOS_EDITAVEIS_PUBLICO: Record<string, string> = {
  titulo: 'titulo', descricao: 'descricao', local: 'local',
  prioridade: 'prioridade', observacoes: 'observacoes',
};
const PRIORIDADES = ['baixa', 'media', 'alta', 'urgente'];

router.put('/os/:id', async (req: Request, res: Response) => {
  const os = await carregarOSPublica(req.params.id);
  if (!os) { res.status(404).json({ error: 'Ordem de serviço não encontrada' }); return; }
  const autor = autorPublico(req.body);
  if (!autor) { res.status(400).json({ error: 'Informe seu nome (mínimo 3 caracteres)' }); return; }
  if (os.status === 'cancelada') { res.status(409).json({ error: 'Esta ordem de serviço foi cancelada' }); return; }

  const fields: string[] = [];
  const values: any[] = [];
  const mudancas: Record<string, unknown> = {};
  let idx = 1;
  for (const [campo, coluna] of Object.entries(CAMPOS_EDITAVEIS_PUBLICO)) {
    const valor = req.body?.[campo];
    if (valor === undefined) continue;
    const texto = String(valor).trim().slice(0, campo === 'titulo' ? 255 : 5000);
    if (campo === 'titulo' && texto.length < 3) { res.status(400).json({ error: 'Título muito curto' }); return; }
    if (campo === 'prioridade') {
      if (!PRIORIDADES.includes(texto)) { res.status(400).json({ error: 'Prioridade inválida' }); return; }
      fields.push(`${coluna} = $${idx++}::prioridade`);
    } else {
      fields.push(`${coluna} = $${idx++}`);
    }
    values.push(texto);
    mudancas[coluna] = texto;
  }
  if (fields.length === 0) { res.status(400).json({ error: 'Nenhum campo para atualizar' }); return; }
  values.push(os.id);
  const row = await queryOne(`UPDATE ordens_servico SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
  await registrarHistorico(os.id, 'edicao', Object.keys(mudancas).join(', '), { mudancas }, autor).catch(() => {});
  res.json({ ...row, ...(await detalhesColaboracao(os.id)) });
});

router.post('/os/:id/fotos', uploadPublico.array('files', 5), async (req: Request, res: Response) => {
  const os = await carregarOSPublica(req.params.id);
  if (!os) { res.status(404).json({ error: 'Ordem de serviço não encontrada' }); return; }
  const autor = autorPublico(req.body);
  if (!autor) { res.status(400).json({ error: 'Informe seu nome (mínimo 3 caracteres)' }); return; }
  const arquivos = (req.files as Express.Multer.File[] | undefined) || [];
  if (arquivos.length === 0) { res.status(400).json({ error: 'Nenhuma imagem enviada' }); return; }
  for (const f of arquivos) {
    if (!bufferMatchesMimeType(f.buffer, f.mimetype)) {
      res.status(400).json({ error: 'Conteúdo do arquivo inválido para o tipo informado' });
      return;
    }
  }
  const urls: Array<{ url: string }> = [];
  for (const f of arquivos) urls.push({ url: await salvarImagemWebp(f.buffer) });
  const resultado = await adicionarFotos(os.id, urls, autor);
  if ('erro' in resultado) { res.status(400).json({ error: resultado.erro }); return; }
  res.status(201).json(resultado);
});

router.delete('/os/:id/fotos/:fotoId', async (req: Request, res: Response) => {
  const os = await carregarOSPublica(req.params.id);
  if (!os) { res.status(404).json({ error: 'Ordem de serviço não encontrada' }); return; }
  if (!idValido(req.params.fotoId)) { res.status(404).json({ error: 'Imagem não encontrada' }); return; }
  const autor = autorPublico(req.query.executadoPor ? { executadoPor: req.query.executadoPor } : req.body);
  if (!autor) { res.status(400).json({ error: 'Informe seu nome (mínimo 3 caracteres)' }); return; }
  const resultado = await removerFoto(os.id, req.params.fotoId, autor);
  if ('erro' in resultado) { res.status(404).json({ error: resultado.erro }); return; }
  res.json(resultado);
});

router.post('/os/:id/status', async (req: Request, res: Response) => {
  if (!idValido(req.params.id)) { res.status(404).json({ error: 'Link inválido' }); return; }
  const { status } = req.body || {};
  const nome = lerNome(req.body);
  if (!nome) { res.status(400).json({ error: 'Informe seu nome (mínimo 3 caracteres)' }); return; }
  if (!STATUS_OS.includes(status)) { res.status(400).json({ error: 'Status inválido' }); return; }

  const atual = await queryOne<{ status: string; criado_por: string | null; protocolo: string; titulo: string }>(
    'SELECT status, criado_por, protocolo, titulo FROM ordens_servico WHERE id = $1', [req.params.id]
  );
  if (!atual) { res.status(404).json({ error: 'Ordem de serviço não encontrada' }); return; }
  if (atual.status === 'cancelada' || atual.status === 'concluida') {
    res.status(409).json({ error: 'Esta ordem de serviço já foi encerrada' });
    return;
  }

  const observacoes = String(req.body?.observacoes || '').trim().slice(0, 2000) || null;
  await execute(
    `UPDATE ordens_servico
     SET status = $1::status_os,
         executado_por_nome = $2,
         observacoes = COALESCE($3, observacoes),
         data_conclusao = CASE WHEN $1 = 'concluida' THEN NOW() ELSE data_conclusao END
     WHERE id = $4`,
    [status, nome, observacoes, req.params.id]
  );
  registrarHistorico(
    req.params.id, 'status', `Status alterado para ${status}`,
    { de: atual.status, para: status }, { id: null, nome, origem: 'publico' }
  ).catch(() => {});
  if (status === 'concluida' && atual.criado_por) {
    const msg = `${atual.protocolo} — ${atual.titulo} concluída por ${nome}`;
    createNotification(atual.criado_por, 'OS concluída', msg, 'info', '/ordens-servico').catch(() => {});
    sendPush(atual.criado_por, { title: 'OS concluída', body: msg, url: '/ordens-servico' }).catch(() => {});
  }
  res.json({ ok: true });
});

// ─── CHECKLIST ───

router.get('/checklist/:id', async (req: Request, res: Response) => {
  if (!idValido(req.params.id)) { res.status(404).json({ error: 'Link inválido' }); return; }
  const row = await queryOne(
    `SELECT ck.id, ck.local, ck.tipo, ck.itens, ck.data, ck.status,
            ck.hora_inicio, ck.hora_fim, ck.executado_por_nome,
            c.nome as condominio_nome, u.nome as responsavel_nome
     FROM checklists ck
     LEFT JOIN condominios c ON c.id = ck.condominio_id
     LEFT JOIN usuarios u ON u.id = ck.responsavel_id
     WHERE ck.id = $1`,
    [req.params.id]
  );
  if (!row) { res.status(404).json({ error: 'Checklist não encontrado' }); return; }
  res.json(row);
});

router.post('/checklist/:id/status', async (req: Request, res: Response) => {
  if (!idValido(req.params.id)) { res.status(404).json({ error: 'Link inválido' }); return; }
  const { status, itens } = req.body || {};
  const nome = lerNome(req.body);
  if (!nome) { res.status(400).json({ error: 'Informe seu nome (mínimo 3 caracteres)' }); return; }
  if (!STATUS_CHECKLIST.includes(status)) { res.status(400).json({ error: 'Status inválido' }); return; }
  if (itens !== undefined && !Array.isArray(itens)) { res.status(400).json({ error: 'Itens inválidos' }); return; }

  const atual = await queryOne<{ status: string; itens: any[] }>(
    'SELECT status, itens FROM checklists WHERE id = $1', [req.params.id]
  );
  if (!atual) { res.status(404).json({ error: 'Checklist não encontrado' }); return; }
  if (atual.status === 'concluido') {
    res.status(409).json({ error: 'Este checklist já foi concluído' });
    return;
  }

  let itensFinal: string | null = null;
  if (Array.isArray(itens) && Array.isArray(atual.itens)) {
    const porId = new Map(
      itens
        .filter(i => i && typeof i === 'object' && i.id !== undefined)
        .map(i => [String(i.id), i])
    );
    itensFinal = JSON.stringify(atual.itens.map(item => {
      const inc = porId.get(String(item.id));
      if (!inc) return item;
      return {
        ...item,
        concluido: !!inc.concluido,
        observacao: typeof inc.observacao === 'string' ? inc.observacao.slice(0, 1000) : item.observacao,
      };
    }));
  }

  await execute(
    `UPDATE checklists
     SET status = $1::status_checklist,
         executado_por_nome = $2,
         itens = COALESCE($3::jsonb, itens),
         hora_inicio = COALESCE(hora_inicio, NOW()),
         hora_fim = CASE WHEN $1 = 'concluido' THEN NOW() ELSE hora_fim END
     WHERE id = $4`,
    [status, nome, itensFinal, req.params.id]
  );
  res.json({ ok: true });
});

// ─── QUADRO DE ATIVIDADES ───

router.get('/atividade/:id', async (req: Request, res: Response) => {
  if (!idValido(req.params.id)) { res.status(404).json({ error: 'Link inválido' }); return; }
  const row = await queryOne(
    `SELECT qa.id, qa.titulo, qa.descricao, qa.status, qa.prioridade, qa.rotina,
            qa.data_especifica, qa.responsavel_nome, qa.executado_por_nome,
            c.nome as condominio_nome
     FROM quadro_atividades qa
     LEFT JOIN condominios c ON c.id = qa.condominio_id
     WHERE qa.id = $1`,
    [req.params.id]
  );
  if (!row) { res.status(404).json({ error: 'Atividade não encontrada' }); return; }
  res.json(row);
});

router.post('/atividade/:id/status', async (req: Request, res: Response) => {
  if (!idValido(req.params.id)) { res.status(404).json({ error: 'Link inválido' }); return; }
  const { status } = req.body || {};
  const nome = lerNome(req.body);
  if (!nome) { res.status(400).json({ error: 'Informe seu nome (mínimo 3 caracteres)' }); return; }
  if (!STATUS_KANBAN.includes(status)) { res.status(400).json({ error: 'Status inválido' }); return; }

  const atual = await queryOne<{ status: string }>(
    'SELECT status FROM quadro_atividades WHERE id = $1', [req.params.id]
  );
  if (!atual) { res.status(404).json({ error: 'Atividade não encontrada' }); return; }

  await execute(
    `UPDATE quadro_atividades
     SET status = $1::status_kanban, executado_por_nome = $2
     WHERE id = $3`,
    [status, nome, req.params.id]
  );
  res.json({ ok: true });
});

export default router;
