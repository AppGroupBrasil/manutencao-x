import cron from 'node-cron';
import { query, queryOne } from './db/database.js';
import { sendEmail, emailVencimentoAlerta } from './services/email.js';
import { sendPush } from './services/push.js';

function gerarProtocolo(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `OS-${y}${m}${d}-${r}`;
}

function calcularProximaExecucao(frequencia: string, base: Date, diaExecucao: number): Date {
  const result = new Date(base);
  switch (frequencia) {
    case 'semanal': result.setDate(result.getDate() + 7); break;
    case 'quinzenal': result.setDate(result.getDate() + 15); break;
    case 'mensal': result.setMonth(result.getMonth() + 1); break;
    case 'bimestral': result.setMonth(result.getMonth() + 2); break;
    case 'trimestral': result.setMonth(result.getMonth() + 3); break;
    case 'semestral': result.setMonth(result.getMonth() + 6); break;
    case 'anual': result.setFullYear(result.getFullYear() + 1); break;
  }
  if (['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'].includes(frequencia) && diaExecucao) {
    result.setDate(Math.min(diaExecucao, new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()));
  }
  return result;
}

/** Gerar OS automáticas a partir de planos preventivos com auto_gerar_os = true */
async function processarPlanos() {
  console.log('[Scheduler] Verificando planos preventivos...');
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);

  const planos = await query(
    `SELECT p.*, e.nome as equipamento_nome, e.codigo as equipamento_codigo
     FROM planos_manutencao p
     LEFT JOIN equipamentos e ON e.id = p.equipamento_id
     WHERE p.status = 'ativo' AND p.auto_gerar_os = true
       AND p.proxima_execucao IS NOT NULL AND p.proxima_execucao <= $1`,
    [hoje]
  );

  let geradas = 0;

  for (const plano of planos) {
    try {
      const protocolo = gerarProtocolo();
      const titulo = `[Preventiva] ${plano.titulo}`;
      const descricao = plano.descricao
        ? `Manutenção preventiva automática.\n\n${plano.descricao}`
        : 'Manutenção preventiva gerada automaticamente pelo scheduler.';

      const os = await queryOne(
        `INSERT INTO ordens_servico (protocolo, condominio_id, titulo, descricao, tipo, prioridade, status,
          responsavel_id, equipamento_id, plano_id, criado_por)
         VALUES ($1, $2, $3, $4, 'preventiva', 'media', 'aberta', $5, $6, $7, $5)
         RETURNING id`,
        [
          protocolo, plano.condominio_id, titulo, descricao,
          plano.responsavel_id || plano.criado_por,
          plano.equipamento_id, plano.id,
        ]
      );

      // Atualizar próxima execução
      const proxima = calcularProximaExecucao(plano.frequencia, new Date(plano.proxima_execucao), plano.dia_execucao || 1);
      await query(
        `UPDATE planos_manutencao SET ultima_execucao = $1, proxima_execucao = $2, atualizado_em = NOW() WHERE id = $3`,
        [new Date(), proxima, plano.id]
      );

      // Registrar execução do scheduler
      await query(
        `INSERT INTO scheduler_execucoes (tipo, plano_id, os_gerada_id, status, detalhes)
         VALUES ('plano_preventivo', $1, $2, 'sucesso', $3)`,
        [plano.id, os?.id, `OS ${protocolo} gerada para plano "${plano.titulo}"`]
      );

      geradas++;
    } catch (err: any) {
      console.error(`[Scheduler] Erro ao processar plano ${plano.id}:`, err.message);
      await query(
        `INSERT INTO scheduler_execucoes (tipo, plano_id, status, detalhes)
         VALUES ('plano_preventivo', $1, 'erro', $2)`,
        [plano.id, err.message]
      ).catch(() => {});
    }
  }

  if (geradas > 0) console.log(`[Scheduler] ${geradas} OS preventivas geradas.`);
}

/** Atualizar status SLA de ordens de serviço */
async function atualizarSLA() {
  console.log('[Scheduler] Atualizando status SLA...');
  const now = new Date();

  // Violados: limite de resolução passou
  const violadas = await query(
    `UPDATE ordens_servico SET sla_status = 'violado'
     WHERE status NOT IN ('concluida','cancelada')
       AND sla_resolucao_limite IS NOT NULL AND sla_resolucao_limite < $1
       AND sla_status != 'violado'
     RETURNING id`,
    [now]
  );

  // Em risco: menos de 25% do tempo restante
  const emRisco = await query(
    `UPDATE ordens_servico SET sla_status = 'em_risco'
     WHERE status NOT IN ('concluida','cancelada')
       AND sla_resolucao_limite IS NOT NULL
       AND sla_status = 'dentro_prazo'
       AND sla_resolucao_limite < $1::timestamptz + (sla_resolucao_limite - data_abertura) * 0.25
     RETURNING id`,
    [now.toISOString()]
  );

  if (violadas.length > 0 || emRisco.length > 0) {
    console.log(`[Scheduler] SLA: ${violadas.length} violadas, ${emRisco.length} em risco.`);
  }
}

function diasAteVencimento(dataVencimento: string): number {
  return Math.ceil((new Date(dataVencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function deveNotificar(dias: number): boolean {
  return dias <= 7 || dias === 15 || dias === 30;
}

async function notificarAdmins(condominioId: string, titulo: string, mensagem: string, link: string) {
  const admins = await query(
    `SELECT id FROM usuarios WHERE role IN ('master','administrador')
     AND (condominio_id = $1 OR role = 'master') AND ativo = true`,
    [condominioId]
  );
  for (const admin of admins) {
    await query(
      `INSERT INTO notificacoes (user_id, titulo, mensagem, tipo, link)
       SELECT $1, $2, $3, 'alerta', $4
       WHERE NOT EXISTS (
         SELECT 1 FROM notificacoes WHERE user_id = $1 AND link = $4
           AND titulo = $2 AND criado_em > NOW() - INTERVAL '1 day'
       )`,
      [admin.id, titulo, mensagem, link]
    ).catch(() => {});
    sendPush(admin.id, { title: titulo, body: mensagem, url: link }).catch(() => {});
  }
}

function enviarEmailVencimento(tituloItem: string, dias: number, condominioNome: string, dataVenc: string, destinatarios: string[]) {
  if (destinatarios.length === 0) return;
  const dataFormatada = new Date(dataVenc).toLocaleDateString('pt-BR');
  const emailOpts = emailVencimentoAlerta(tituloItem, dias, condominioNome, dataFormatada);
  emailOpts.to = destinatarios;
  sendEmail(emailOpts).catch((err) => console.error('[Scheduler] Erro email:', err));
}

/** Verificar vencimentos próximos (documentos + vencimentos) e enviar e-mail + push */
async function verificarVencimentos() {
  console.log('[Scheduler] Verificando vencimentos...');
  const em30dias = new Date();
  em30dias.setDate(em30dias.getDate() + 30);

  // Buscar e-mails globais cadastrados
  const emailRow = await queryOne<{ emails: string[] }>('SELECT emails FROM vencimentos_emails WHERE id = $1', ['global']);
  const emailsGlobais: string[] = emailRow?.emails?.length ? emailRow.emails : [];

  // ── 1. Documentos técnicos ──
  const docs = await query(
    `SELECT dt.id, dt.titulo, dt.data_validade, dt.condominio_id, c.nome as condominio_nome
     FROM documentos_tecnicos dt
     LEFT JOIN condominios c ON c.id = dt.condominio_id
     WHERE dt.status = 'vigente' AND dt.data_validade IS NOT NULL
       AND dt.data_validade <= $1 AND dt.data_validade >= CURRENT_DATE`,
    [em30dias]
  );

  for (const doc of docs) {
    const dias = diasAteVencimento(doc.data_validade);
    if (!deveNotificar(dias)) continue;
    await notificarAdmins(doc.condominio_id, `Documento vence em ${dias} dias`, `"${doc.titulo}" vence em ${dias} dias.`, '/documentos');
    enviarEmailVencimento(doc.titulo, dias, doc.condominio_nome || '', doc.data_validade, emailsGlobais);
  }

  // ── 2. Vencimentos (tabela vencimentos) ──
  const vencs = await query(
    `SELECT v.id, v.titulo, v.data_vencimento, v.condominio_id, v.emails, c.nome as condominio_nome
     FROM vencimentos v
     LEFT JOIN condominios c ON c.id = v.condominio_id
     WHERE v.data_vencimento IS NOT NULL
       AND v.data_vencimento <= $1 AND v.data_vencimento >= CURRENT_DATE`,
    [em30dias]
  );

  for (const v of vencs) {
    const dias = diasAteVencimento(v.data_vencimento);
    if (!deveNotificar(dias)) continue;
    await notificarAdmins(v.condominio_id, `Vencimento em ${dias} dias`, `"${v.titulo}" vence em ${dias} dias.`, '/vencimentos');
    const destinatarios = [...new Set([...emailsGlobais, ...(v.emails || [])])];
    enviarEmailVencimento(v.titulo, dias, v.condominio_nome || '', v.data_vencimento, destinatarios);
  }
}

/** Verificar contratos de fornecedores prestes a vencer */
async function verificarContratos() {
  console.log('[Scheduler] Verificando contratos de fornecedores...');

  const contratos = await query(
    `SELECT fc.id, fc.numero_contrato, fc.data_fim, fc.alerta_dias_antes, fc.renovacao_automatica,
            f.nome as fornecedor_nome, fc.condominio_id
     FROM fornecedores_contratos fc
     JOIN fornecedores f ON f.id = fc.fornecedor_id
     WHERE fc.status = 'vigente' AND fc.data_fim IS NOT NULL
       AND fc.data_fim <= CURRENT_DATE + fc.alerta_dias_antes * INTERVAL '1 day'
       AND fc.data_fim >= CURRENT_DATE`,
    []
  );

  for (const c of contratos) {
    const dias = Math.ceil((new Date(c.data_fim).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const admins = await query(
      `SELECT id FROM usuarios WHERE role IN ('master','administrador')
       AND (condominio_id = $1 OR role = 'master') AND ativo = true`,
      [c.condominio_id]
    );
    for (const admin of admins) {
      await query(
        `INSERT INTO notificacoes (user_id, titulo, mensagem, tipo, link)
         SELECT $1, $2, $3, 'alerta', '/fornecedores'
         WHERE NOT EXISTS (
           SELECT 1 FROM notificacoes WHERE user_id = $1
             AND titulo = $2 AND criado_em > NOW() - INTERVAL '1 day'
         )`,
        [
          admin.id,
          `Contrato vence em ${dias} dias`,
          `Contrato ${c.numero_contrato || ''} do fornecedor "${c.fornecedor_nome}" vence em ${dias} dias.`
        ]
      ).catch(() => {});
    }
  }

  if (contratos.length > 0) console.log(`[Scheduler] ${contratos.length} contratos próximos do vencimento.`);
}

/** Purge de tabelas voláteis. Evita crescimento sem limite. */
async function purgarTabelasVolateis() {
  console.log('[Scheduler] Purge de tabelas voláteis...');
  const queries: [string, string][] = [
    ['refresh_tokens', `DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '7 days' OR (revogado = true AND usado_em < NOW() - INTERVAL '7 days')`],
    ['reset_tokens',   `DELETE FROM reset_tokens WHERE expires_at < NOW() - INTERVAL '7 days' OR used = true`],
    ['login_attempts', `DELETE FROM login_attempts WHERE criado_em < NOW() - INTERVAL '7 days'`],
    ['audit_logs',     `DELETE FROM audit_logs WHERE criado_em < NOW() - INTERVAL '180 days'`],
    ['metricas_uso',   `DELETE FROM metricas_uso WHERE data < NOW() - INTERVAL '180 days'`],
    ['notificacoes',   `DELETE FROM notificacoes WHERE lida = true AND criado_em < NOW() - INTERVAL '60 days'`],
  ];
  for (const [nome, sql] of queries) {
    try { await query(sql); } catch (e: any) { console.error(`[Scheduler] Purge ${nome}:`, e.message); }
  }
}

// Eleição simples para evitar duplicação em múltiplos containers.
// Apenas o processo cujo PID coincide com o hash do dia roda o scheduler.
const SCHEDULER_INSTANCE_ID = process.env.SCHEDULER_INSTANCE_ID || '';
function deveRodarScheduler(): boolean {
  if (process.env.DISABLE_SCHEDULER === 'true') return false;
  if (SCHEDULER_INSTANCE_ID && SCHEDULER_INSTANCE_ID !== '1') return false;
  return true;
}

export function iniciarScheduler() {
  if (!deveRodarScheduler()) {
    console.log('[Scheduler] desativado (SCHEDULER_INSTANCE_ID != 1 ou DISABLE_SCHEDULER=true)');
    return;
  }
  // A cada hora: verificar planos preventivos + SLA
  cron.schedule('0 * * * *', async () => {
    try { await processarPlanos(); } catch (e: any) { console.error('[Scheduler] Erro planos:', e.message); }
    try { await atualizarSLA(); } catch (e: any) { console.error('[Scheduler] Erro SLA:', e.message); }
  });

  // Diariamente às 7h: verificar vencimentos
  cron.schedule('0 7 * * *', async () => {
    try { await verificarVencimentos(); } catch (e: any) { console.error('[Scheduler] Erro vencimentos:', e.message); }
  });

  // Executar uma vez na inicialização
  setTimeout(async () => {
    try { await processarPlanos(); } catch (e: any) { console.error('[Scheduler] Erro planos init:', e.message); }
    try { await atualizarSLA(); } catch (e: any) { console.error('[Scheduler] Erro SLA init:', e.message); }
  }, 5000);

  // Diariamente às 8h: verificar contratos a vencer
  cron.schedule('0 8 * * *', async () => {
    try { await verificarContratos(); } catch (e: any) { console.error('[Scheduler] Erro contratos:', e.message); }
  });

  // Diariamente às 3h: purge de tabelas voláteis
  cron.schedule('0 3 * * *', async () => {
    try { await purgarTabelasVolateis(); } catch (e: any) { console.error('[Scheduler] Erro purge:', e.message); }
  });

  console.log('[Scheduler] Tarefas agendadas: planos (1h), SLA (1h), vencimentos (7h), contratos (8h), purge (3h)');
}
