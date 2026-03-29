import { Router, Response } from 'express';
import { query } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();


type CalendarEventType = 'os' | 'plano' | 'vencimento' | 'escala' | 'documento' | 'fornecedor' | 'contrato';

interface CalendarEvent {
  id: string;
  titulo: string;
  data: string;
  tipo: CalendarEventType;
  status?: string;
  prioridade?: string;
  extra?: string;
}

function toIsoDate(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

function construirEscalasDoMes(rows: any[], inicioMes: string, fimMes: string): CalendarEvent[] {
  const eventos: CalendarEvent[] = [];
  const cursor = new Date(`${inicioMes}T12:00:00`);
  const limite = new Date(`${fimMes}T12:00:00`);

  while (cursor <= limite) {
    const diaSemana = cursor.getDay();
    const data = toIsoDate(cursor);

    for (const escala of rows) {
      if (escala.dia_semana !== diaSemana) continue;
      const funcionario = escala.funcionario_nome || 'Equipe';
      const titulo = escala.funcao ? `${escala.funcao} - ${funcionario}` : `Escala - ${funcionario}`;
      const extra = [escala.hora_inicio && escala.hora_fim ? `${escala.hora_inicio}-${escala.hora_fim}` : null, escala.local || null]
        .filter(Boolean)
        .join(' • ');

      eventos.push({
        id: `${escala.id}-${data}`,
        titulo,
        data,
        tipo: 'escala',
        extra: extra || undefined,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return eventos;
}

// GET /api/calendario — eventos consolidados com todas as fontes datadas
router.get('/', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  if (ids.length === 0) {
    res.json({ eventos: [], os: [], planos: [], vencimentos: [], escalas: [], documentos: [], fornecedores: [], contratos: [] });
    return;
  }

  const mes = req.query.mes as string; // formato YYYY-MM
  let inicioMes: string, fimMes: string;

  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    inicioMes = `${mes}-01`;
    const [y, m] = mes.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    fimMes = `${mes}-${String(lastDay).padStart(2, '0')}`;
  } else {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    inicioMes = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    fimMes = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  const [osRows, planos, vencimentosRows, documentos, fornecedores, contratos, escalasBase] = await Promise.all([
    query(
      `SELECT id, protocolo, titulo, status, prioridade, data_abertura, data_previsao,
              condominio_id
       FROM ordens_servico
       WHERE condominio_id = ANY($1)
         AND (
           (data_abertura IS NOT NULL AND data_abertura::date BETWEEN $2 AND $3)
           OR (data_previsao IS NOT NULL AND data_previsao::date BETWEEN $2 AND $3)
         )
       ORDER BY COALESCE(data_previsao, data_abertura)`,
      [ids, inicioMes, fimMes]
    ),
    query(
      `SELECT id, titulo, frequencia, proxima_execucao as data, status, 'plano' as tipo,
              condominio_id
       FROM planos_manutencao
       WHERE condominio_id = ANY($1) AND status = 'ativo'
         AND proxima_execucao IS NOT NULL AND proxima_execucao::date BETWEEN $2 AND $3
       ORDER BY proxima_execucao`,
      [ids, inicioMes, fimMes]
    ),
    query(
      `SELECT id, titulo, descricao, tipo, data_vencimento, data_proxima_manutencao, qtd_notificacoes, condominio_id
       FROM vencimentos
       WHERE condominio_id = ANY($1)
         AND (
           (data_vencimento IS NOT NULL AND data_vencimento::date BETWEEN $2 AND $3)
           OR (data_proxima_manutencao IS NOT NULL AND data_proxima_manutencao::date BETWEEN $2 AND $3)
         )
       ORDER BY COALESCE(data_vencimento, data_proxima_manutencao)`,
      [ids, inicioMes, fimMes]
    ).catch(() => []),
    query(
      `SELECT id, titulo, tipo, status, data_validade, condominio_id
       FROM documentos_tecnicos
       WHERE condominio_id = ANY($1)
         AND data_validade IS NOT NULL AND data_validade::date BETWEEN $2 AND $3
       ORDER BY data_validade`,
      [ids, inicioMes, fimMes]
    ).catch(() => []),
    query(
      `SELECT id, nome, especialidade, status, data_fim_contrato, condominio_id
       FROM fornecedores
       WHERE condominio_id = ANY($1)
         AND data_fim_contrato IS NOT NULL AND data_fim_contrato::date BETWEEN $2 AND $3
       ORDER BY data_fim_contrato`,
      [ids, inicioMes, fimMes]
    ).catch(() => []),
    query(
      `SELECT id, numero_contrato, descricao, status, data_fim, alerta_dias_antes, condominio_id
       FROM fornecedores_contratos
       WHERE condominio_id = ANY($1)
         AND data_fim IS NOT NULL AND data_fim::date BETWEEN $2 AND $3
       ORDER BY data_fim`,
      [ids, inicioMes, fimMes]
    ).catch(() => []),
    query(
      `SELECT id, funcionario_nome, dia_semana, hora_inicio, hora_fim, local, funcao,
              condominio_id
       FROM escalas
       WHERE condominio_id = ANY($1) AND ativo = true
       ORDER BY dia_semana, hora_inicio`,
      [ids]
    ).catch(() => []),
  ]);

  const os: CalendarEvent[] = [];
  for (const osRow of osRows) {
    if (osRow.data_abertura) {
      os.push({
        id: `os-abertura-${osRow.id}`,
        titulo: osRow.titulo,
        data: toIsoDate(osRow.data_abertura),
        tipo: 'os',
        status: osRow.status,
        prioridade: osRow.prioridade,
        extra: osRow.protocolo,
      });
    }
    if (osRow.data_previsao) {
      os.push({
        id: `os-previsao-${osRow.id}`,
        titulo: `[Previsão] ${osRow.titulo}`,
        data: toIsoDate(osRow.data_previsao),
        tipo: 'os',
        status: osRow.status,
        prioridade: osRow.prioridade,
        extra: osRow.protocolo,
      });
    }
  }

  const vencimentos: CalendarEvent[] = [];
  for (const row of vencimentosRows as any[]) {
    const tituloBase = row.titulo || row.descricao || 'Vencimento';
    if (row.data_vencimento) {
      vencimentos.push({
        id: `vencimento-${row.id}`,
        titulo: tituloBase,
        data: toIsoDate(row.data_vencimento),
        tipo: 'vencimento',
        extra: row.tipo || undefined,
      });
    }
    if (row.data_proxima_manutencao) {
      vencimentos.push({
        id: `vencimento-manutencao-${row.id}`,
        titulo: `[Próxima manutenção] ${tituloBase}`,
        data: toIsoDate(row.data_proxima_manutencao),
        tipo: 'vencimento',
        extra: row.tipo || undefined,
      });
    }
  }

  const documentosEventos: CalendarEvent[] = (documentos as any[]).map((row) => ({
    id: `documento-${row.id}`,
    titulo: row.titulo,
    data: toIsoDate(row.data_validade),
    tipo: 'documento',
    status: row.status,
    extra: row.tipo || 'Documento técnico',
  }));

  const fornecedoresEventos: CalendarEvent[] = (fornecedores as any[]).map((row) => ({
    id: `fornecedor-${row.id}`,
    titulo: `[Contrato fornecedor] ${row.nome}`,
    data: toIsoDate(row.data_fim_contrato),
    tipo: 'fornecedor',
    status: row.status,
    extra: row.especialidade || undefined,
  }));

  const contratosEventos: CalendarEvent[] = (contratos as any[]).map((row) => ({
    id: `contrato-${row.id}`,
    titulo: row.numero_contrato ? `[Contrato ${row.numero_contrato}] ${row.descricao || 'Sem descrição'}` : `[Contrato] ${row.descricao || 'Sem descrição'}`,
    data: toIsoDate(row.data_fim),
    tipo: 'contrato',
    status: row.status,
    extra: row.alerta_dias_antes ? `Alerta ${row.alerta_dias_antes} dias antes` : undefined,
  }));

  const escalas = construirEscalasDoMes(escalasBase as any[], inicioMes, fimMes);

  const eventos = [
    ...os,
    ...(planos as CalendarEvent[]),
    ...vencimentos,
    ...documentosEventos,
    ...fornecedoresEventos,
    ...contratosEventos,
    ...escalas,
  ].sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo));

  // Buscar anotações do mês
  const anotacoes = await query(
    `SELECT id, data::text, texto, cor, usuario_id, criado_em, atualizado_em
     FROM calendario_anotacoes
     WHERE condominio_id = ANY($1) AND data BETWEEN $2 AND $3
     ORDER BY data, criado_em`,
    [ids, inicioMes, fimMes]
  ).catch(() => []);

  res.json({
    eventos,
    os,
    planos,
    vencimentos,
    escalas,
    documentos: documentosEventos,
    fornecedores: fornecedoresEventos,
    contratos: contratosEventos,
    anotacoes,
  });
});

// ── Anotações por data ──

// GET /api/calendario/anotacoes?mes=YYYY-MM
router.get('/anotacoes', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const mes = req.query.mes as string;
  let inicioMes: string, fimMes: string;
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    inicioMes = `${mes}-01`;
    const [y, m] = mes.split('-').map(Number);
    fimMes = `${mes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  } else {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    inicioMes = `${y}-${String(m).padStart(2, '0')}-01`;
    fimMes = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  }
  const rows = await query(
    `SELECT id, data::text, texto, cor, usuario_id, criado_em, atualizado_em
     FROM calendario_anotacoes
     WHERE condominio_id = ANY($1) AND data BETWEEN $2 AND $3
     ORDER BY data, criado_em`,
    [ids, inicioMes, fimMes]
  );
  res.json(rows);
});

// POST /api/calendario/anotacoes
router.post('/anotacoes', async (req: AuthRequest, res: Response) => {
  const condId = (req as any).condominioIds?.[0];
  if (!condId) { res.status(400).json({ error: 'Condomínio não selecionado' }); return; }
  const { data, texto, cor } = req.body;
  if (!data || !texto) { res.status(400).json({ error: 'Data e texto são obrigatórios' }); return; }
  if (cor && !/^#[0-9a-fA-F]{6}$/.test(cor)) { res.status(400).json({ error: 'Cor inválida' }); return; }
  const [row] = await query(
    `INSERT INTO calendario_anotacoes (condominio_id, data, texto, cor, usuario_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, data::text, texto, cor, usuario_id, criado_em`,
    [condId, data, texto.slice(0, 500), cor || '#ffffff', req.user!.id]
  );
  res.status(201).json(row);
});

// PUT /api/calendario/anotacoes/:id
router.put('/anotacoes/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { texto, cor } = req.body;
  if (cor && !/^#[0-9a-fA-F]{6}$/.test(cor)) { res.status(400).json({ error: 'Cor inválida' }); return; }
  const [row] = await query(
    `UPDATE calendario_anotacoes SET texto = COALESCE($1, texto), cor = COALESCE($2, cor), atualizado_em = NOW()
     WHERE id = $3 AND condominio_id = ANY($4) RETURNING id, data::text, texto, cor`,
    [texto?.slice(0, 500), cor, req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Anotação não encontrada' }); return; }
  res.json(row);
});

// DELETE /api/calendario/anotacoes/:id
router.delete('/anotacoes/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const [row] = await query(
    'DELETE FROM calendario_anotacoes WHERE id = $1 AND condominio_id = ANY($2) RETURNING id',
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Anotação não encontrada' }); return; }
  res.json({ ok: true });
});

// ── Legendas personalizadas ──

// GET /api/calendario/legendas
router.get('/legendas', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const rows = await query(
    'SELECT id, cor, rotulo FROM calendario_legendas WHERE condominio_id = ANY($1) ORDER BY rotulo',
    [ids]
  );
  res.json(rows);
});

// POST /api/calendario/legendas
router.post('/legendas', async (req: AuthRequest, res: Response) => {
  const condId = (req as any).condominioIds?.[0];
  if (!condId) { res.status(400).json({ error: 'Condomínio não selecionado' }); return; }
  const { cor, rotulo } = req.body;
  if (!cor || !rotulo) { res.status(400).json({ error: 'Cor e rótulo são obrigatórios' }); return; }
  if (!/^#[0-9a-fA-F]{6}$/.test(cor)) { res.status(400).json({ error: 'Cor inválida' }); return; }
  const [row] = await query(
    `INSERT INTO calendario_legendas (condominio_id, cor, rotulo)
     VALUES ($1, $2, $3)
     ON CONFLICT (condominio_id, cor) DO UPDATE SET rotulo = EXCLUDED.rotulo
     RETURNING id, cor, rotulo`,
    [condId, cor, rotulo.slice(0, 60)]
  );
  res.status(201).json(row);
});

// PUT /api/calendario/legendas/:id
router.put('/legendas/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const { cor, rotulo } = req.body;
  if (cor && !/^#[0-9a-fA-F]{6}$/.test(cor)) { res.status(400).json({ error: 'Cor inválida' }); return; }
  const [row] = await query(
    `UPDATE calendario_legendas SET cor = COALESCE($1, cor), rotulo = COALESCE($2, rotulo)
     WHERE id = $3 AND condominio_id = ANY($4) RETURNING id, cor, rotulo`,
    [cor, rotulo?.slice(0, 60), req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Legenda não encontrada' }); return; }
  res.json(row);
});

// DELETE /api/calendario/legendas/:id
router.delete('/legendas/:id', async (req: AuthRequest, res: Response) => {
  const ids: string[] = (req as any).condominioIds;
  const [row] = await query(
    'DELETE FROM calendario_legendas WHERE id = $1 AND condominio_id = ANY($2) RETURNING id',
    [req.params.id, ids]
  );
  if (!row) { res.status(404).json({ error: 'Legenda não encontrada' }); return; }
  res.json({ ok: true });
});

export default router;
