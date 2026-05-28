import { Router, Response } from 'express';
import { query, queryOne } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

import { apiCache } from '../middleware/cache.js';

const router = Router();

// GET /api/dashboard/summary
router.get('/summary', apiCache(60), async (req: AuthRequest, res: Response) => {
  const ids: string[] = req.condominioIds!;
  if (ids.length === 0) {
    res.json({
      totalCondominios: 0, reportesAbertos: 0,
      totalTarefas: 0, execucoesHoje: 0,
      funcionariosHoje: 0, vencimentosProximos: 0,
      semanalArr: [], tipoArr: [], desempenho: [], atividades: [],
    });
    return;
  }

  const ph = ids.map((_, i) => `$${i + 1}`).join(',');

  const [
    condominiosCount,
    reportesStats,
    tarefasCount,
    execucoesHoje,
    funcionariosHoje,
    vencimentosProximos,
    semanalRows,
    categoriaRows,
    desempenhoRows,
    atividadeReportes,
    atividadeExecs,
    atividadePonto,
    atividadeVenc,
  ] = await Promise.all([
    queryOne(`SELECT COUNT(*)::int as total FROM condominios WHERE id IN (${ph}) AND ativo = true`, ids),
    queryOne(`SELECT COUNT(*) FILTER (WHERE status != 'resolvido')::int as abertos FROM reportes WHERE condominio_id IN (${ph})`, ids),
    queryOne(`SELECT COUNT(*)::int as total FROM tarefas_agendadas WHERE condominio_id IN (${ph})`, ids),
    queryOne(`SELECT COUNT(*)::int as total FROM tarefas_execucoes te JOIN tarefas_agendadas ta ON ta.id = te.tarefa_id WHERE ta.condominio_id IN (${ph}) AND te.data_execucao = CURRENT_DATE`, ids),
    queryOne(`SELECT COUNT(DISTINCT cp.funcionario_email)::int as total FROM controle_ponto cp JOIN usuarios u ON u.id = cp.funcionario_id WHERE cp.tipo = 'entrada' AND cp.data_hora::date = CURRENT_DATE AND u.condominio_id IN (${ph})`, ids),
    queryOne(`SELECT COUNT(*)::int as total FROM vencimentos WHERE condominio_id IN (${ph}) AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`, ids),
    // Weekly chart: last 7 days - reportes + execucoes
    query(`
      SELECT d::date as dia,
        COALESCE((SELECT COUNT(*)::int FROM reportes WHERE condominio_id IN (${ph}) AND data = d::date), 0) as abertas,
        COALESCE((SELECT COUNT(*)::int FROM reportes WHERE condominio_id IN (${ph}) AND data = d::date AND status = 'resolvido'), 0) +
        COALESCE((SELECT COUNT(*)::int FROM tarefas_execucoes te JOIN tarefas_agendadas ta ON ta.id = te.tarefa_id WHERE ta.condominio_id IN (${ph}) AND te.data_execucao = d::date AND te.status = 'realizada'), 0) as concluidas
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day') d
      ORDER BY d`, ids),
    // Category distribution from roteiros
    query(`SELECT COALESCE(categoria, 'Outro') as nome, COUNT(*)::int as valor FROM roteiros WHERE condominio_id IN (${ph}) GROUP BY categoria ORDER BY valor DESC LIMIT 10`, ids),
    // Monthly performance last 6 months
    query(`
      SELECT TO_CHAR(te.data_execucao, 'YYYY-MM') as mes,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE te.status = 'realizada')::int as realizadas
      FROM tarefas_execucoes te JOIN tarefas_agendadas ta ON ta.id = te.tarefa_id
      WHERE ta.condominio_id IN (${ph}) AND te.data_execucao >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(te.data_execucao, 'YYYY-MM')
      ORDER BY mes`, ids),
    // Recent activities: reportes
    query(`SELECT protocolo, status, prioridade, data FROM reportes WHERE condominio_id IN (${ph}) ORDER BY data DESC LIMIT 10`, ids),
    // Recent activities: execucoes
    query(`SELECT te.status, te.data_execucao, te.hora_execucao, te.funcionario_nome FROM tarefas_execucoes te JOIN tarefas_agendadas ta ON ta.id = te.tarefa_id WHERE ta.condominio_id IN (${ph}) ORDER BY te.data_execucao DESC, te.hora_execucao DESC LIMIT 10`, ids),
    // Recent activities: ponto
    query(`SELECT cp.funcionario_nome, cp.tipo, cp.data_hora FROM controle_ponto cp JOIN usuarios u ON u.id = cp.funcionario_id WHERE u.condominio_id IN (${ph}) ORDER BY cp.data_hora DESC LIMIT 10`, ids),
    // Recent vencimentos
    query(`SELECT titulo, data_vencimento FROM vencimentos WHERE condominio_id IN (${ph}) AND data_vencimento BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE + INTERVAL '15 days' ORDER BY data_vencimento LIMIT 10`, ids),
  ]);

  const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const semanalArr = (semanalRows || []).map((r: any) => ({
    dia: NOMES_DIA[new Date(r.dia).getDay()],
    abertas: r.abertas || 0,
    concluidas: r.concluidas || 0,
  }));

  const tipoArr = (categoriaRows || []).map((r: any) => ({ nome: r.nome, valor: r.valor }));

  const desempenho: { mes: string; nota: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = (desempenhoRows || []).find((r: any) => r.mes === prefix);
    const total = row?.total || 0;
    const realizadas = row?.realizadas || 0;
    desempenho.push({ mes: NOMES_MES[d.getMonth()], nota: total > 0 ? Math.round((realizadas / total) * 5 * 10) / 10 : 0 });
  }

  const now = Date.now();
  const formatarTempo = (ts: number) => {
    if (!Number.isFinite(ts)) return 'â€”';
    const diff = now - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `${min} min atrás`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
  };
  const parseTimestamp = (dateValue: unknown, timeValue?: unknown) => {
    if (dateValue instanceof Date) {
      const direct = dateValue.getTime();
      if (Number.isFinite(direct)) return direct;
    }

    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      const direct = new Date(dateValue).getTime();
      if (Number.isFinite(direct)) return direct;
    }

    if ((typeof dateValue === 'string' || typeof dateValue === 'number') && typeof timeValue === 'string') {
      const combined = new Date(`${dateValue}T${timeValue}`).getTime();
      if (Number.isFinite(combined)) return combined;
    }

    return Number.NaN;
  };

  const atividades: { texto: string; tempo: string; tipo: string; ts: number }[] = [];
  for (const r of (atividadeReportes || [])) {
    const t = parseTimestamp(r.data);
    atividades.push({
      texto: `Reporte ${r.protocolo || ''} — ${r.status === 'resolvido' ? 'resolvido' : r.status === 'em_analise' ? 'em análise' : 'aberto'}`,
      tempo: formatarTempo(t), ts: t,
      tipo: r.status === 'resolvido' ? 'sucesso' : r.prioridade === 'urgente' || r.prioridade === 'alta' ? 'perigo' : 'info',
    });
  }
  for (const e of (atividadeExecs || [])) {
    const t = parseTimestamp(e.data_execucao, e.hora_execucao || '00:00');
    atividades.push({
      texto: `Tarefa ${e.status === 'realizada' ? 'concluída' : e.status === 'nao_executada' ? 'não executada' : 'pendente'} — ${e.funcionario_nome || ''}`,
      tempo: formatarTempo(t), ts: t,
      tipo: e.status === 'realizada' ? 'sucesso' : e.status === 'nao_executada' ? 'perigo' : 'aviso',
    });
  }
  for (const p of (atividadePonto || [])) {
    const t = parseTimestamp(p.data_hora);
    atividades.push({
      texto: `${p.funcionario_nome || 'Funcionário'} — ${p.tipo === 'entrada' ? 'Check-in' : 'Check-out'}`,
      tempo: formatarTempo(t), ts: t, tipo: 'info',
    });
  }
  for (const v of (atividadeVenc || [])) {
    const t = parseTimestamp(v.data_vencimento);
    const diff = Number.isFinite(t) ? Math.floor((t - now) / 86400000) : 0;
    atividades.push({
      texto: `Vencimento "${v.titulo}" ${diff < 0 ? 'VENCIDO' : `em ${diff} dia${diff !== 1 ? 's' : ''}`}`,
      tempo: formatarTempo(t), ts: t,
      tipo: diff < 0 ? 'perigo' : diff <= 7 ? 'aviso' : 'info',
    });
  }
  atividades.sort((a, b) => (Number.isFinite(b.ts) ? b.ts : -1) - (Number.isFinite(a.ts) ? a.ts : -1));

  res.json({
    totalCondominios: condominiosCount?.total || 0,
    reportesAbertos: reportesStats?.abertos || 0,
    totalTarefas: tarefasCount?.total || 0,
    execucoesHoje: execucoesHoje?.total || 0,
    funcionariosHoje: funcionariosHoje?.total || 0,
    vencimentosProximos: vencimentosProximos?.total || 0,
    semanalArr,
    tipoArr,
    desempenho,
    atividades: atividades.slice(0, 6),
  });
});

// GET /api/dashboard/master-summary (master only — system management overview)
router.get('/master-summary', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'master') {
    res.status(403).json({ error: 'Acesso restrito ao master' });
    return;
  }

  const [
    totalCondominios,
    condominiosAtivos,
    condominiosTeste,
    condominiosInadimplentes,
    condominiosBloqueados,
    totalAdmins,
    totalUsuarios,
    usuariosAtivos,
    usuariosBloqueados,
    usuariosSemVinculo,
    condominiosRecentes,
    adminsRecentes,
    cadastrosMensal,
  ] = await Promise.all([
    queryOne('SELECT COUNT(*)::int as total FROM condominios', []),
    queryOne(`SELECT COUNT(*)::int as total FROM condominios WHERE ativo = true AND status_plano = 'ativo'`, []),
    queryOne(`SELECT COUNT(*)::int as total FROM condominios WHERE ativo = true AND status_plano = 'teste'`, []),
    queryOne(`SELECT COUNT(*)::int as total FROM condominios WHERE ativo = true AND status_plano = 'inadimplente'`, []),
    queryOne(`SELECT COUNT(*)::int as total FROM condominios WHERE ativo = false OR status_plano = 'bloqueado'`, []),
    queryOne(`SELECT COUNT(*)::int as total FROM usuarios WHERE role = 'administrador'`, []),
    queryOne(`SELECT COUNT(*)::int as total FROM usuarios WHERE role != 'master'`, []),
    queryOne(`SELECT COUNT(*)::int as total FROM usuarios WHERE ativo = true AND role != 'master'`, []),
    queryOne(`SELECT COUNT(*)::int as total FROM usuarios WHERE bloqueado = true`, []),
    queryOne(`SELECT COUNT(*)::int as total FROM usuarios WHERE condominio_id IS NULL AND role = 'funcionario'`, []),
    query(
      `SELECT c.id, c.nome, c.cidade, c.estado, c.status_plano, c.plano, c.criado_em, c.data_fim_teste, c.ativo,
              u.nome as admin_nome, u.email as admin_email,
              (SELECT COUNT(*)::int FROM usuarios WHERE condominio_id = c.id) as total_usuarios
       FROM condominios c
       LEFT JOIN usuarios u ON u.id = c.criado_por
       ORDER BY c.criado_em DESC LIMIT 20`, []
    ),
    query(
      `SELECT id, nome, email, telefone, ativo, bloqueado, criado_em FROM usuarios WHERE role = 'administrador' ORDER BY criado_em DESC LIMIT 10`, []
    ),
    query(
      `SELECT TO_CHAR(criado_em, 'YYYY-MM') as mes, COUNT(*)::int as total
       FROM condominios WHERE criado_em >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(criado_em, 'YYYY-MM') ORDER BY mes`, []
    ),
  ]);

  // Expiration alerts: condominios with teste expiring in <= 3 days
  const alertasExpiracao = await query(
    `SELECT c.id, c.nome, c.data_fim_teste, c.status_plano, u.nome as admin_nome
     FROM condominios c LEFT JOIN usuarios u ON u.id = c.criado_por
     WHERE c.status_plano = 'teste' AND c.data_fim_teste IS NOT NULL
       AND c.data_fim_teste <= NOW() + INTERVAL '3 days'
     ORDER BY c.data_fim_teste`, []
  );

  const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const cadastrosMensalArr: { mes: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = (cadastrosMensal || []).find((r: any) => r.mes === prefix);
    cadastrosMensalArr.push({ mes: NOMES_MES[d.getMonth()], total: row?.total || 0 });
  }

  res.json({
    totalCondominios: totalCondominios?.total || 0,
    condominiosAtivos: condominiosAtivos?.total || 0,
    condominiosTeste: condominiosTeste?.total || 0,
    condominiosInadimplentes: condominiosInadimplentes?.total || 0,
    condominiosBloqueados: condominiosBloqueados?.total || 0,
    totalAdmins: totalAdmins?.total || 0,
    totalUsuarios: totalUsuarios?.total || 0,
    usuariosAtivos: usuariosAtivos?.total || 0,
    usuariosBloqueados: usuariosBloqueados?.total || 0,
    usuariosSemVinculo: usuariosSemVinculo?.total || 0,
    condominiosRecentes: condominiosRecentes || [],
    adminsRecentes: adminsRecentes || [],
    cadastrosMensalArr,
    alertasExpiracao: alertasExpiracao || [],
  });
});

// GET /api/dashboard/master-users (all users grouped by admin with condominios/moradores)
router.get('/master-users', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'master') {
    res.status(403).json({ error: 'Acesso restrito ao master' }); return;
  }

  // All users (non-master) with their admin info
  const users = await query(
    `SELECT u.id, u.email, u.nome, u.role, u.ativo, u.bloqueado, u.motivo_bloqueio,
            u.administrador_id, u.supervisor_id, u.condominio_id, u.telefone, u.cargo, u.criado_em,
            a.nome as admin_nome, a.email as admin_email,
            c.nome as condominio_nome
     FROM usuarios u
     LEFT JOIN usuarios a ON a.id = u.administrador_id
     LEFT JOIN condominios c ON c.id = u.condominio_id
     WHERE u.role != 'master'
     ORDER BY u.role, u.nome`
  );

  // Condominios with admin + moradores count
  const conds = await query(
    `SELECT c.id, c.nome, c.status_plano, c.plano, c.ativo, c.criado_por, c.criado_em,
            u.nome as admin_nome, u.email as admin_email,
            (SELECT COUNT(*)::int FROM moradores WHERE condominio_id = c.id) as total_moradores
     FROM condominios c
     LEFT JOIN usuarios u ON u.id = c.criado_por
     ORDER BY c.criado_em DESC`
  );

  // Moradores per condominio
  const moradores = await query(
    `SELECT m.id, m.nome, m.condominio_id, m.bloco, m.apartamento, m.whatsapp, m.email, m.perfil, m.criado_em,
            c.nome as condominio_nome
     FROM moradores m
     JOIN condominios c ON c.id = m.condominio_id
     ORDER BY c.nome, m.nome`
  );

  // Summary counts by role
  const countsByRole = await query(
    `SELECT role, COUNT(*)::int as total FROM usuarios WHERE role != 'master' GROUP BY role`
  );

  res.json({ users, condominios: conds, moradores, countsByRole });
});

// GET /api/dashboard/master-report (filterable report)
router.get('/master-report', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'master') {
    res.status(403).json({ error: 'Acesso restrito ao master' }); return;
  }

  const { dataInicio, dataFim, statusPlano } = req.query as any;

  let condWhere = 'WHERE 1=1';
  const condParams: any[] = [];
  let pi = 1;

  if (dataInicio) { condWhere += ` AND c.criado_em >= $${pi++}`; condParams.push(dataInicio); }
  if (dataFim) { condWhere += ` AND c.criado_em <= $${pi++}`; condParams.push(dataFim + 'T23:59:59'); }
  if (statusPlano && statusPlano !== 'todos') { condWhere += ` AND c.status_plano = $${pi++}`; condParams.push(statusPlano); }

  const condominios = await query(
    `SELECT c.id, c.nome, c.cidade, c.estado, c.status_plano, c.plano, c.ativo, c.criado_em,
            c.data_inicio_teste, c.data_fim_teste, c.valor_mensalidade,
            u.nome as admin_nome, u.email as admin_email,
            (SELECT COUNT(*)::int FROM usuarios WHERE condominio_id = c.id) as total_usuarios,
            (SELECT COUNT(*)::int FROM moradores WHERE condominio_id = c.id) as total_moradores
     FROM condominios c
     LEFT JOIN usuarios u ON u.id = c.criado_por
     ${condWhere}
     ORDER BY c.criado_em DESC`,
    condParams
  );

  let userWhere = `WHERE u.role != 'master'`;
  const userParams: any[] = [];
  let ui = 1;
  if (dataInicio) { userWhere += ` AND u.criado_em >= $${ui++}`; userParams.push(dataInicio); }
  if (dataFim) { userWhere += ` AND u.criado_em <= $${ui++}`; userParams.push(dataFim + 'T23:59:59'); }

  const usuarios = await query(
    `SELECT u.id, u.nome, u.email, u.role, u.ativo, u.bloqueado, u.criado_em, u.telefone,
            a.nome as admin_nome, c.nome as condominio_nome
     FROM usuarios u
     LEFT JOIN usuarios a ON a.id = u.administrador_id
     LEFT JOIN condominios c ON c.id = u.condominio_id
     ${userWhere}
     ORDER BY u.role, u.nome`,
    userParams
  );

  res.json({ condominios, usuarios });
});

export default router;

