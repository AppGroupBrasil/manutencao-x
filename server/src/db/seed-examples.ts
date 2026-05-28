import bcrypt from 'bcryptjs';
import { PoolClient } from 'pg';
import pool from './database.js';

type UserRole = 'master' | 'administrador' | 'supervisor' | 'funcionario';

type UserRow = {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
};

type IdRow = { id: string };

const examplePassword = process.env.EXAMPLE_PASSWORD || 'Exemplo@2026!';

async function tableExists(client: PoolClient, tableName: string) {
  const result = await client.query<{ exists: string | null }>('SELECT to_regclass($1) AS exists', [`public.${tableName}`]);
  return Boolean(result.rows[0]?.exists);
}

async function findId(client: PoolClient, query: string, params: unknown[]) {
  const result = await client.query<IdRow>(query, params);
  return result.rows[0]?.id || null;
}

async function ensureMaster(client: PoolClient) {
  const existing = await client.query<UserRow>(
    `SELECT id, email, nome, role
     FROM usuarios
     WHERE role = 'master'
     ORDER BY criado_em
     LIMIT 1`
  );

  if (existing.rows[0]) return existing.rows[0];

  const senhaHash = await bcrypt.hash(process.env.MASTER_PASSWORD || examplePassword, 12);
  const created = await client.query<UserRow>(
    `INSERT INTO usuarios (email, senha_hash, nome, role, criado_por)
     VALUES ($1,$2,$3,'master',NULL)
     RETURNING id, email, nome, role`,
    [process.env.MASTER_EMAIL || 'master@manutencaox.com.br', senhaHash, 'Master Admin']
  );

  return created.rows[0];
}

async function ensureUser(
  client: PoolClient,
  input: {
    email: string;
    nome: string;
    role: UserRole;
    criadoPor: string | null;
    administradorId?: string | null;
    supervisorId?: string | null;
    condominioId?: string | null;
    cargo?: string;
    telefone?: string;
  }
) {
  const existing = await client.query<UserRow>('SELECT id, email, nome, role FROM usuarios WHERE email = $1 LIMIT 1', [input.email]);
  const senhaHash = await bcrypt.hash(examplePassword, 12);

  if (existing.rows[0]) {
    const updated = await client.query<UserRow>(
      `UPDATE usuarios
       SET nome = $2,
           senha_hash = $3,
           role = $4,
           criado_por = $5,
           administrador_id = $6,
           supervisor_id = $7,
           condominio_id = $8,
           cargo = $9,
           telefone = $10,
           ativo = true,
           bloqueado = false,
           atualizado_em = NOW()
       WHERE email = $1
       RETURNING id, email, nome, role`,
      [
        input.email,
        input.nome,
        senhaHash,
        input.role,
        input.criadoPor,
        input.administradorId || null,
        input.supervisorId || null,
        input.condominioId || null,
        input.cargo || null,
        input.telefone || null,
      ]
    );
    return updated.rows[0];
  }

  const created = await client.query<UserRow>(
    `INSERT INTO usuarios (
      email, senha_hash, nome, role, criado_por, administrador_id, supervisor_id, condominio_id, cargo, telefone
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id, email, nome, role`,
    [
      input.email,
      senhaHash,
      input.nome,
      input.role,
      input.criadoPor,
      input.administradorId || null,
      input.supervisorId || null,
      input.condominioId || null,
      input.cargo || null,
      input.telefone || null,
    ]
  );

  return created.rows[0];
}

async function ensureCondominio(
  client: PoolClient,
  input: {
    nome: string;
    criadoPor: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    sindico: string;
    telefone: string;
    email: string;
    blocos: number;
    unidades: number;
  }
) {
  const existingId = await findId(client, 'SELECT id FROM condominios WHERE nome = $1 LIMIT 1', [input.nome]);
  if (existingId) return existingId;

  const created = await client.query<IdRow>(
    `INSERT INTO condominios (
      nome, endereco, cidade, estado, cep, sindico, telefone, email, blocos, unidades, criado_por
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id`,
    [
      input.nome,
      input.endereco,
      input.cidade,
      input.estado,
      input.cep,
      input.sindico,
      input.telefone,
      input.email,
      input.blocos,
      input.unidades,
      input.criadoPor,
    ]
  );

  return created.rows[0].id;
}

async function ensureByKey(
  client: PoolClient,
  selectSql: string,
  selectParams: unknown[],
  insertSql: string,
  insertParams: unknown[]
) {
  const existing = await client.query(selectSql, selectParams);
  if (existing.rows.length > 0) return existing.rows[0];
  const inserted = await client.query(insertSql, insertParams);
  return inserted.rows[0] || null;
}

async function createExamples() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const master = await ensureMaster(client);
    const admin = await ensureUser(client, {
      email: 'admin.exemplo@manutencaox.com.br',
      nome: 'Administrador Exemplo',
      role: 'administrador',
      criadoPor: master.id,
      cargo: 'Administrador Predial',
      telefone: '(11) 99999-1001',
    });

    const masterCondoId = await ensureCondominio(client, {
      nome: 'Condomínio Exemplo Master',
      criadoPor: master.id,
      endereco: 'Av. Central, 100',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000-100',
      sindico: 'Síndico Master',
      telefone: '(11) 4000-1000',
      email: 'master.condominio@manutencaox.com.br',
      blocos: 2,
      unidades: 64,
    });

    const operationalCondoId = await ensureCondominio(client, {
      nome: 'Condomínio Exemplo Operacional',
      criadoPor: admin.id,
      endereco: 'Rua das Palmeiras, 250',
      cidade: 'Campinas',
      estado: 'SP',
      cep: '13000-250',
      sindico: 'Mariana Costa',
      telefone: '(19) 4000-2000',
      email: 'operacional@manutencaox.com.br',
      blocos: 4,
      unidades: 128,
    });

    await client.query('UPDATE usuarios SET condominio_id = $2, atualizado_em = NOW() WHERE id = $1', [admin.id, operationalCondoId]);

    const supervisor = await ensureUser(client, {
      email: 'supervisor.exemplo@manutencaox.com.br',
      nome: 'Supervisor Exemplo',
      role: 'supervisor',
      criadoPor: admin.id,
      administradorId: admin.id,
      condominioId: operationalCondoId,
      cargo: 'Supervisor de Operações',
      telefone: '(19) 99999-2002',
    });

    const funcionario = await ensureUser(client, {
      email: 'funcionario.exemplo@manutencaox.com.br',
      nome: 'Funcionário Exemplo',
      role: 'funcionario',
      criadoPor: admin.id,
      administradorId: admin.id,
      supervisorId: supervisor.id,
      condominioId: operationalCondoId,
      cargo: 'Auxiliar de Manutenção',
      telefone: '(19) 99999-3003',
    });

    const funcionarioDois = await ensureUser(client, {
      email: 'funcionario2.exemplo@manutencaox.com.br',
      nome: 'Funcionário Apoio',
      role: 'funcionario',
      criadoPor: admin.id,
      administradorId: admin.id,
      supervisorId: supervisor.id,
      condominioId: operationalCondoId,
      cargo: 'Porteiro',
      telefone: '(19) 99999-3004',
    });

    const morador = await ensureByKey(
      client,
      'SELECT id FROM moradores WHERE email = $1 LIMIT 1',
      ['moradora.exemplo@manutencaox.com.br'],
      `INSERT INTO moradores (nome, condominio_id, bloco, apartamento, whatsapp, email, perfil)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      ['Moradora Exemplo', operationalCondoId, 'B', '204', '(19) 98888-1000', 'moradora.exemplo@manutencaox.com.br', 'Proprietário']
    );

    const checklist = await ensureByKey(
      client,
      'SELECT id FROM checklists WHERE condominio_id = $1 AND local = $2 LIMIT 1',
      [operationalCondoId, 'Casa de Máquinas'],
      `INSERT INTO checklists (condominio_id, local, tipo, itens, responsavel_id, supervisor_id, data, status, criado_por)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        operationalCondoId,
        'Casa de Máquinas',
        'diaria',
        JSON.stringify([
          { id: 'chk-1', item: 'Verificar pressão da bomba', concluido: true },
          { id: 'chk-2', item: 'Inspecionar quadro elétrico', concluido: false },
        ]),
        funcionario.id,
        supervisor.id,
        '2026-03-26',
        'em_andamento',
        admin.id,
      ]
    );

    await ensureByKey(
      client,
      'SELECT id FROM vencimentos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Contrato do Elevador'],
      `INSERT INTO vencimentos (titulo, tipo, descricao, condominio_id, data_vencimento, emails, avisos, qtd_notificacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
       RETURNING id`,
      [
        'Contrato do Elevador',
        'contrato',
        'Exemplo para testar a agenda de vencimentos.',
        operationalCondoId,
        '2026-04-15',
        ['operacional@manutencaox.com.br'],
        JSON.stringify([{ id: 'ven-1', tipo: 'dias_antes', valor: 7 }]),
        1,
      ]
    );

    await ensureByKey(
      client,
      'SELECT id FROM ordens_servico WHERE protocolo = $1 LIMIT 1',
      ['OS-EX-0001'],
      `INSERT INTO ordens_servico (
        protocolo, condominio_id, titulo, descricao, tipo, prioridade, status, local,
        responsavel_id, supervisor_id, observacoes, data_previsao, criado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id`,
      [
        'OS-EX-0001',
        operationalCondoId,
        'Troca de iluminação da garagem',
        'OS exemplo para validar fluxo operacional.',
        'manutencao',
        'alta',
        'em_andamento',
        'Garagem subsolo',
        funcionario.id,
        supervisor.id,
        'Necessário substituir 4 luminárias.',
        '2026-03-28T10:00:00Z',
        admin.id,
      ]
    );

    const tarefa = await ensureByKey(
      client,
      'SELECT id FROM tarefas_agendadas WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Ronda técnica da cobertura'],
      `INSERT INTO tarefas_agendadas (
        titulo, descricao, funcionario_id, funcionario_nome, condominio_id, bloco, local, recorrencia, dias_semana, criado_por, prioridade
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id`,
      [
        'Ronda técnica da cobertura',
        'Exemplo de tarefa recorrente para supervisor acompanhar.',
        funcionario.id,
        funcionario.nome,
        operationalCondoId,
        'Cobertura',
        'Reservatórios e exaustores',
        'semanal',
        [1, 3, 5],
        admin.id,
        'media',
      ]
    );

    if (tarefa?.id) {
      await ensureByKey(
        client,
        'SELECT id FROM tarefas_execucoes WHERE tarefa_id = $1 AND data_execucao = $2 LIMIT 1',
        [tarefa.id, '2026-03-26'],
        `INSERT INTO tarefas_execucoes (
          tarefa_id, funcionario_id, funcionario_nome, status, observacao, data_execucao, hora_execucao, latitude, longitude
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id`,
        [tarefa.id, funcionario.id, funcionario.nome, 'concluido', 'Ronda concluída sem anomalias críticas.', '2026-03-26', '08:15', -22.9099, -47.0626]
      );
    }

    await ensureByKey(
      client,
      'SELECT id FROM escalas WHERE condominio_id = $1 AND funcionario_id = $2 AND dia_semana = $3 LIMIT 1',
      [operationalCondoId, funcionarioDois.id, 1],
      `INSERT INTO escalas (condominio_id, funcionario_id, funcionario_nome, dia_semana, hora_inicio, hora_fim, local, funcao, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [operationalCondoId, funcionarioDois.id, funcionarioDois.nome, 1, '08:00', '17:00', 'Portaria', 'Porteiro', 'Escala exemplo de segunda-feira.']
    );

    const material = await ensureByKey(
      client,
      'SELECT id FROM materiais WHERE protocolo = $1 LIMIT 1',
      ['MAT-EX-0001'],
      `INSERT INTO materiais (
        protocolo, nome, categoria, unidade, quantidade, quantidade_minima, custo_unitario, email_notificacao, condominio_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id`,
      ['MAT-EX-0001', 'Lâmpada LED 18W', 'Elétrica', 'un', 42, 10, 18.90, 'estoque@manutencaox.com.br', operationalCondoId]
    );

    if (material?.id) {
      await ensureByKey(
        client,
        'SELECT id FROM materiais_movimentacoes WHERE material_id = $1 AND tipo = $2 AND quantidade = $3 LIMIT 1',
        [material.id, 'saida', 4],
        `INSERT INTO materiais_movimentacoes (material_id, tipo, quantidade, observacao, funcionario_id, funcionario_nome)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [material.id, 'saida', 4, 'Uso em manutenção da garagem.', funcionario.id, funcionario.nome]
      );
    }

    await ensureByKey(
      client,
      'SELECT id FROM inspecoes WHERE condominio_id = $1 AND tipo = $2 AND local = $3 LIMIT 1',
      [operationalCondoId, 'elevadores', 'Torre A'],
      `INSERT INTO inspecoes (condominio_id, tipo, local, inspetor_id, status, observacoes, itens_verificados)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING id`,
      [operationalCondoId, 'elevadores', 'Torre A', supervisor.id, 'conforme', 'Inspeção mensal concluída.', JSON.stringify([{ item: 'Cabine limpa', ok: true }, { item: 'Sensores testados', ok: true }])]
    );

    const vistoria = await ensureByKey(
      client,
      'SELECT id FROM vistorias WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Vistoria de rotina da piscina'],
      `INSERT INTO vistorias (titulo, condominio_id, tipo, data, responsavel_id, responsavel_nome, status, itens)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       RETURNING id`,
      ['Vistoria de rotina da piscina', operationalCondoId, 'rotina', '2026-03-27', supervisor.id, supervisor.nome, 'pendente', JSON.stringify([{ item: 'Casa de máquinas', status: 'ok' }, { item: 'Borda e drenagem', status: 'pendente' }])]
    );

    await ensureByKey(
      client,
      'SELECT id FROM reportes WHERE protocolo = $1 LIMIT 1',
      ['REP-EX-0001'],
      `INSERT INTO reportes (protocolo, item_desc, checklist_id, vistoria_id, descricao, status, prioridade, condominio_id, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      ['REP-EX-0001', 'Bomba de recalque', checklist?.id || null, vistoria?.id || null, 'Ruído acima do padrão observado durante checklist.', 'em_analise', 'alta', operationalCondoId, supervisor.id]
    );

    await ensureByKey(
      client,
      'SELECT id FROM comunicados WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Teste de manutenção preventiva'],
      `INSERT INTO comunicados (tipo, titulo, mensagem, destinatario_tipo, condominio_id, emails_enviados, enviado_por, enviado_por_nome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      ['aviso', 'Teste de manutenção preventiva', 'Comunicado exemplo para testar o módulo de comunicados.', 'todos', operationalCondoId, ['operacional@manutencaox.com.br'], admin.id, admin.nome]
    );

    await ensureByKey(
      client,
      'SELECT id FROM quadro_atividades WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Acompanhar revisão do gerador'],
      `INSERT INTO quadro_atividades (
        titulo, descricao, status, prioridade, rotina, responsavel_id, responsavel_nome, condominio_id, criado_por, historico
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      RETURNING id`,
      ['Acompanhar revisão do gerador', 'Card exemplo para o quadro de atividades.', 'em_andamento', 'alta', 'mensal', supervisor.id, supervisor.nome, operationalCondoId, admin.id, JSON.stringify([{ data: new Date().toISOString(), acao: 'Card criado como exemplo' }])]
    );

    const roteiro = await ensureByKey(
      client,
      'SELECT id FROM roteiros WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Roteiro da casa de bombas'],
      `INSERT INTO roteiros (titulo, descricao, categoria, passos, condominio_id, criado_por)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6)
       RETURNING id`,
      ['Roteiro da casa de bombas', 'Fluxo padrão para inspeção e registro.', 'manutencao', JSON.stringify([{ ordem: 1, titulo: 'Checar ruídos' }, { ordem: 2, titulo: 'Registrar pressão' }]), operationalCondoId, supervisor.id]
    );

    if (roteiro?.id) {
      await ensureByKey(
        client,
        'SELECT id FROM roteiros_execucoes_log WHERE roteiro_id = $1 AND funcionario_id = $2 LIMIT 1',
        [roteiro.id, funcionario.id],
        `INSERT INTO roteiros_execucoes_log (roteiro_id, funcionario_id, funcionario_nome, passos_exec)
         VALUES ($1,$2,$3,$4::jsonb)
         RETURNING id`,
        [roteiro.id, funcionario.id, funcionario.nome, JSON.stringify([{ ordem: 1, ok: true }, { ordem: 2, ok: true }])]
      );
    }

    const qrcode = await ensureByKey(
      client,
      'SELECT id FROM qrcodes WHERE condominio_id = $1 AND nome = $2 LIMIT 1',
      [operationalCondoId, 'QR Equipamento Exemplo'],
      `INSERT INTO qrcodes (nome, descricao, blocos, condominio_id, criado_por)
       VALUES ($1,$2,$3::jsonb,$4,$5)
       RETURNING id`,
      ['QR Equipamento Exemplo', 'QR Code exemplo para leituras e respostas.', JSON.stringify([{ id: 'b1', titulo: 'Identificação', campos: [] }]), operationalCondoId, supervisor.id]
    );

    if (qrcode?.id) {
      await ensureByKey(
        client,
        'SELECT id FROM respostas_qrcode WHERE qrcode_id = $1 AND respondido_por = $2 LIMIT 1',
        [qrcode.id, funcionario.id],
        `INSERT INTO respostas_qrcode (
          qrcode_id, qrcode_nome, identificacao, respostas, respondido_por, respondido_por_nome, respondido_por_email
        ) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7)
        RETURNING id`,
        [qrcode.id, 'QR Equipamento Exemplo', JSON.stringify({ bloco: 'Casa de bombas' }), JSON.stringify({ pressao: 'normal', observacao: 'Sem vazamentos' }), funcionario.id, funcionario.nome, funcionario.email]
      );
    }

    await ensureByKey(
      client,
      'SELECT id FROM leituras_qrcode WHERE qr_conteudo = $1 AND funcionario_id = $2 LIMIT 1',
      ['QR Equipamento Exemplo', funcionario.id],
      `INSERT INTO leituras_qrcode (
        qr_conteudo, funcionario_id, funcionario_nome, funcionario_email, funcionario_cargo, latitude, longitude, endereco
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id`,
      ['QR Equipamento Exemplo', funcionario.id, funcionario.nome, funcionario.email, 'Auxiliar de Manutenção', -22.9099, -47.0626, 'Casa de bombas']
    );

    await ensureByKey(
      client,
      'SELECT id FROM controle_ponto WHERE funcionario_id = $1 AND tipo = $2 LIMIT 1',
      [funcionarioDois.id, 'entrada'],
      `INSERT INTO controle_ponto (
        funcionario_id, funcionario_nome, funcionario_email, funcionario_cargo, tipo, latitude, longitude, endereco, permanencia
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id`,
      [funcionarioDois.id, funcionarioDois.nome, funcionarioDois.email, 'Porteiro', 'entrada', -22.9105, -47.0622, 'Portaria principal', '08h00']
    );

    await ensureByKey(
      client,
      'SELECT id FROM geolocalizacao WHERE user_id = $1 AND data = $2 LIMIT 1',
      [funcionario.id, '2026-03-26'],
      `INSERT INTO geolocalizacao (user_id, latitude, longitude, endereco, hora_chegada, tempo_total, data, funcao_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [funcionario.id, -22.9099, -47.0626, 'Cobertura técnica', '2026-03-26T08:00:00Z', 95, '2026-03-26', 'ronda-tecnica']
    );

    await ensureByKey(
      client,
      'SELECT id FROM audit_logs WHERE user_id = $1 AND acao = $2 LIMIT 1',
      [admin.id, 'seed_exemplo_executado'],
      `INSERT INTO audit_logs (user_id, user_nome, user_role, acao, entidade, detalhes, ip)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       RETURNING id`,
      [admin.id, admin.nome, admin.role, 'seed_exemplo_executado', 'sistema', JSON.stringify({ origem: 'db:seed:examples' }), '127.0.0.1']
    );

    await ensureByKey(
      client,
      'SELECT id FROM notificacoes WHERE user_id = $1 AND titulo = $2 LIMIT 1',
      [admin.id, 'Dados de exemplo disponíveis'],
      `INSERT INTO notificacoes (user_id, titulo, mensagem, tipo, link)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [admin.id, 'Dados de exemplo disponíveis', 'O ambiente local foi populado com registros para testes.', 'success', '/dashboard']
    );

    await ensureByKey(
      client,
      'SELECT id FROM metricas_uso WHERE condominio_id = $1 AND user_id = $2 AND acao = $3 AND data = $4 LIMIT 1',
      [operationalCondoId, admin.id, 'seed:examples', '2026-03-26'],
      `INSERT INTO metricas_uso (condominio_id, user_id, acao, data)
       VALUES ($1,$2,$3,$4)
       RETURNING id`,
      [operationalCondoId, admin.id, 'seed:examples', '2026-03-26']
    );

    await ensureByKey(
      client,
      'SELECT id FROM sla_registros WHERE condominio_id = $1 AND categoria = $2 AND descricao = $3 LIMIT 1',
      [operationalCondoId, 'manutencao', 'Incidente exemplo para acompanhamento SLA.'],
      `INSERT INTO sla_registros (bloco_id, categoria, descricao, status, condominio_id, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
      ['bloco-a', 'manutencao', 'Incidente exemplo para acompanhamento SLA.', 'em_atendimento', operationalCondoId, supervisor.id]
    );

    await ensureByKey(
      client,
      'SELECT id FROM whats_contatos WHERE condominio_id = $1 AND telefone = $2 LIMIT 1',
      [operationalCondoId, '(19) 97777-2000'],
      `INSERT INTO whats_contatos (nome, telefone, condominio_id)
       VALUES ($1,$2,$3)
       RETURNING id`,
      ['Síndica Mariana', '(19) 97777-2000', operationalCondoId]
    );

    if (await tableExists(client, 'fornecedores')) {
      // ── Fornecedor 1: Alpha Elevadores ──
      const fornecedor = await ensureByKey(
        client,
        'SELECT id FROM fornecedores WHERE condominio_id = $1 AND nome = $2 LIMIT 1',
        [operationalCondoId, 'Alpha Elevadores'],
        `INSERT INTO fornecedores (
          nome, tipo, especialidade, telefone, email, cidade, estado, contato_nome, contato_telefone,
          valor_contrato, data_inicio_contrato, data_fim_contrato, condominio_id, criado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id`,
        ['Alpha Elevadores', 'prestador', 'Manutenção de elevadores', '(19) 4000-3000', 'contato@alphaelevadores.com', 'Campinas', 'SP', 'Ricardo Silva', '(19) 98888-3000', 1850.00, '2026-01-01', '2026-12-31', operationalCondoId, admin.id]
      );

      // ── Fornecedor 2: HidroTec Bombas ──
      const fornecedor2 = await ensureByKey(
        client,
        'SELECT id FROM fornecedores WHERE condominio_id = $1 AND nome = $2 LIMIT 1',
        [operationalCondoId, 'HidroTec Bombas'],
        `INSERT INTO fornecedores (
          nome, cnpj, tipo, especialidade, telefone, email, cidade, estado, contato_nome, contato_telefone, contato_email,
          valor_contrato, data_inicio_contrato, data_fim_contrato, status, condominio_id, criado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING id`,
        ['HidroTec Bombas', '12.345.678/0001-99', 'assistencia_tecnica', 'Bombas e sistemas hidráulicos', '(19) 4000-4000', 'suporte@hidrotec.com.br', 'Campinas', 'SP', 'Fernanda Oliveira', '(19) 98888-4000', 'fernanda@hidrotec.com.br', 980.00, '2026-02-01', '2027-01-31', 'ativo', operationalCondoId, admin.id]
      );

      // ── Fornecedor 3: EletroSafe ──
      const fornecedor3 = await ensureByKey(
        client,
        'SELECT id FROM fornecedores WHERE condominio_id = $1 AND nome = $2 LIMIT 1',
        [operationalCondoId, 'EletroSafe Instalações'],
        `INSERT INTO fornecedores (
          nome, cnpj, tipo, especialidade, telefone, email, cidade, estado, contato_nome, contato_telefone,
          status, condominio_id, criado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id`,
        ['EletroSafe Instalações', '98.765.432/0001-10', 'prestador', 'Instalações elétricas e SPDA', '(19) 4000-5000', 'orcamento@eletrosafe.com.br', 'Campinas', 'SP', 'Jorge Pereira', '(19) 98888-5000', 'ativo', operationalCondoId, admin.id]
      );

      // ── Fornecedor 4: PoolClean (distribuidor) ──
      await ensureByKey(
        client,
        'SELECT id FROM fornecedores WHERE condominio_id = $1 AND nome = $2 LIMIT 1',
        [operationalCondoId, 'PoolClean Produtos'],
        `INSERT INTO fornecedores (
          nome, tipo, especialidade, telefone, email, cidade, estado, contato_nome,
          status, condominio_id, criado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id`,
        ['PoolClean Produtos', 'distribuidor', 'Produtos químicos para piscina', '(19) 4000-6000', 'vendas@poolclean.com.br', 'Sumaré', 'SP', 'Ana Beatriz', 'ativo', operationalCondoId, admin.id]
      );

      if (fornecedor?.id && await tableExists(client, 'equipamentos')) {
        // ── Equipamento 1: Elevador Torre A ──
        const equipamento = await ensureByKey(
          client,
          'SELECT id FROM equipamentos WHERE codigo = $1 LIMIT 1',
          ['EQ-EX-0001'],
          `INSERT INTO equipamentos (
            codigo, nome, descricao, categoria, marca, modelo, localizacao, andar, data_instalacao,
            fornecedor_id, status, condominio_id, criado_por
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          RETURNING id`,
          ['EQ-EX-0001', 'Elevador Torre A', 'Elevador social da Torre A, capacidade 8 pessoas.', 'elevador', 'Otis', 'Gen2', 'Torre A', 'Térreo', '2022-05-10', fornecedor.id, 'ativo', operationalCondoId, admin.id]
        );

        // ── Equipamento 2: Bomba de Recalque ──
        const eqBomba = await ensureByKey(
          client,
          'SELECT id FROM equipamentos WHERE codigo = $1 LIMIT 1',
          ['EQ-EX-0002'],
          `INSERT INTO equipamentos (
            codigo, nome, descricao, categoria, marca, modelo, numero_serie, localizacao, andar, data_instalacao,
            data_garantia, vida_util_anos, potencia, fornecedor_id, status, condominio_id, criado_por
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          RETURNING id`,
          ['EQ-EX-0002', 'Bomba de Recalque Principal', 'Bomba centrífuga para abastecimento de água.', 'bomba', 'Schneider', 'BC-21 R 1½', 'SN-2024-78452', 'Casa de Máquinas', 'Subsolo', '2024-01-15', '2027-01-15', 15, '3 CV', fornecedor2?.id || null, 'ativo', operationalCondoId, admin.id]
        );

        // ── Equipamento 3: Gerador de Emergência ──
        const eqGerador = await ensureByKey(
          client,
          'SELECT id FROM equipamentos WHERE codigo = $1 LIMIT 1',
          ['EQ-EX-0003'],
          `INSERT INTO equipamentos (
            codigo, nome, descricao, categoria, marca, modelo, numero_serie, localizacao, andar, data_instalacao,
            vida_util_anos, potencia, status, condominio_id, criado_por
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
          RETURNING id`,
          ['EQ-EX-0003', 'Gerador de Emergência', 'Gerador diesel automático para falta de energia.', 'gerador', 'Cummins', 'C150D5', 'SN-GEN-2023-001', 'Casa de Máquinas', 'Subsolo', '2023-06-20', 20, '150 kVA', 'ativo', operationalCondoId, admin.id]
        );

        // ── Equipamento 4: Central de Incêndio ──
        await ensureByKey(
          client,
          'SELECT id FROM equipamentos WHERE codigo = $1 LIMIT 1',
          ['EQ-EX-0004'],
          `INSERT INTO equipamentos (
            codigo, nome, descricao, categoria, marca, modelo, localizacao, andar, data_instalacao,
            status, condominio_id, criado_por
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          RETURNING id`,
          ['EQ-EX-0004', 'Central de Alarme de Incêndio', 'Painel central com 32 zonas de detecção.', 'incendio', 'Intelbras', 'CIC-32', 'Portaria', 'Térreo', '2023-01-10', 'ativo', operationalCondoId, admin.id]
        );

        // ── Equipamento 5: Portão Automático ──
        await ensureByKey(
          client,
          'SELECT id FROM equipamentos WHERE codigo = $1 LIMIT 1',
          ['EQ-EX-0005'],
          `INSERT INTO equipamentos (
            codigo, nome, descricao, categoria, marca, modelo, localizacao, data_instalacao,
            status, condominio_id, criado_por
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          RETURNING id`,
          ['EQ-EX-0005', 'Portão Automático Garagem', 'Portão deslizante com motor industrial.', 'portao', 'PPA', 'DZ Rio 800', 'Entrada Garagem', '2024-03-01', 'ativo', operationalCondoId, admin.id]
        );

        // ── Equipamento 6: Sistema CFTV ──
        await ensureByKey(
          client,
          'SELECT id FROM equipamentos WHERE codigo = $1 LIMIT 1',
          ['EQ-EX-0006'],
          `INSERT INTO equipamentos (
            codigo, nome, descricao, categoria, marca, modelo, localizacao, andar, data_instalacao,
            status, observacoes, condominio_id, criado_por
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          RETURNING id`,
          ['EQ-EX-0006', 'DVR + 16 Câmeras IP', 'Sistema de monitoramento com 16 câmeras Full HD.', 'cftv', 'Hikvision', 'DS-7216HQHI-K2', 'Sala de Segurança', 'Térreo', '2025-01-20', 'ativo', '8 câmeras externas, 8 internas.', operationalCondoId, admin.id]
        );

        // ── Equipamento 7: Ar-condicionado em manutenção ──
        await ensureByKey(
          client,
          'SELECT id FROM equipamentos WHERE codigo = $1 LIMIT 1',
          ['EQ-EX-0007'],
          `INSERT INTO equipamentos (
            codigo, nome, descricao, categoria, marca, modelo, localizacao, andar,
            status, observacoes, condominio_id, criado_por
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          RETURNING id`,
          ['EQ-EX-0007', 'Ar-Condicionado Salão de Festas', 'Split inverter 36000 BTUs.', 'hvac', 'Samsung', 'AR24TSHCBWKNAZ', 'Salão de Festas', '1º Andar', 'manutencao', 'Aguardando peça do compressor.', operationalCondoId, admin.id]
        );

        if (equipamento?.id && await tableExists(client, 'equipamentos_historico')) {
          await ensureByKey(
            client,
            'SELECT id FROM equipamentos_historico WHERE equipamento_id = $1 AND descricao = $2 LIMIT 1',
            [equipamento.id, 'Lubrificação preventiva exemplo.'],
            `INSERT INTO equipamentos_historico (
              equipamento_id, tipo, descricao, data_servico, custo, fornecedor_id, fornecedor_nome, tecnico, realizado_por
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id`,
            [equipamento.id, 'manutencao', 'Lubrificação preventiva exemplo.', '2026-03-10', 450.00, fornecedor.id, 'Alpha Elevadores', 'Carlos Técnico', supervisor.id]
          );

          // Segundo histórico
          await ensureByKey(
            client,
            'SELECT id FROM equipamentos_historico WHERE equipamento_id = $1 AND descricao = $2 LIMIT 1',
            [equipamento.id, 'Troca de cabos de aço.'],
            `INSERT INTO equipamentos_historico (
              equipamento_id, tipo, descricao, data_servico, custo, fornecedor_id, fornecedor_nome, tecnico, realizado_por
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id`,
            [equipamento.id, 'manutencao', 'Troca de cabos de aço.', '2025-11-20', 3200.00, fornecedor.id, 'Alpha Elevadores', 'Marcos Souza', supervisor.id]
          );
        }

        // Histórico da bomba
        if (eqBomba?.id && await tableExists(client, 'equipamentos_historico')) {
          await ensureByKey(
            client,
            'SELECT id FROM equipamentos_historico WHERE equipamento_id = $1 AND descricao = $2 LIMIT 1',
            [eqBomba.id, 'Troca do selo mecânico.'],
            `INSERT INTO equipamentos_historico (
              equipamento_id, tipo, descricao, data_servico, custo, fornecedor_id, fornecedor_nome, tecnico, realizado_por
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id`,
            [eqBomba.id, 'manutencao', 'Troca do selo mecânico.', '2026-02-18', 780.00, fornecedor2?.id || null, 'HidroTec Bombas', 'Paulo Lima', supervisor.id]
          );
        }

        if (equipamento?.id && await tableExists(client, 'planos_manutencao')) {
          // ── Plano 1: Elevador Mensal ──
          const plano = await ensureByKey(
            client,
            'SELECT id FROM planos_manutencao WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
            [operationalCondoId, 'Plano Elevador Mensal'],
            `INSERT INTO planos_manutencao (
              titulo, descricao, equipamento_id, categoria_equipamento, frequencia, dia_execucao,
              itens_verificacao, responsavel_id, fornecedor_id, custo_estimado, proxima_execucao,
              auto_gerar_os, status, condominio_id, criado_por
            ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15)
            RETURNING id`,
            ['Plano Elevador Mensal', 'Manutenção preventiva mensal do elevador social.', equipamento.id, 'elevador', 'mensal', 5, JSON.stringify([{ item: 'Checar cabos de aço', obrigatorio: true }, { item: 'Testar freio de emergência', obrigatorio: true }, { item: 'Lubrificar guias', obrigatorio: true }, { item: 'Verificar painel de comando', obrigatorio: false }]), supervisor.id, fornecedor.id, 650.00, '2026-04-05', true, 'ativo', operationalCondoId, admin.id]
          );

          // ── Plano 2: Bomba Trimestral ──
          await ensureByKey(
            client,
            'SELECT id FROM planos_manutencao WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
            [operationalCondoId, 'Revisão Trimestral da Bomba'],
            `INSERT INTO planos_manutencao (
              titulo, descricao, equipamento_id, categoria_equipamento, frequencia, dia_execucao,
              itens_verificacao, responsavel_id, fornecedor_id, custo_estimado, proxima_execucao,
              auto_gerar_os, status, condominio_id, criado_por
            ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15)
            RETURNING id`,
            ['Revisão Trimestral da Bomba', 'Inspeção e manutenção preventiva do sistema de recalque.', eqBomba?.id || null, 'bomba', 'trimestral', 10, JSON.stringify([{ item: 'Verificar pressão manométrica', obrigatorio: true }, { item: 'Checar selo mecânico', obrigatorio: true }, { item: 'Medir corrente elétrica', obrigatorio: true }]), supervisor.id, fornecedor2?.id || null, 980.00, '2026-06-10', true, 'ativo', operationalCondoId, admin.id]
          );

          // ── Plano 3: Gerador Semestral ──
          await ensureByKey(
            client,
            'SELECT id FROM planos_manutencao WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
            [operationalCondoId, 'Revisão Semestral do Gerador'],
            `INSERT INTO planos_manutencao (
              titulo, descricao, equipamento_id, categoria_equipamento, frequencia, dia_execucao,
              itens_verificacao, custo_estimado, proxima_execucao,
              auto_gerar_os, status, condominio_id, criado_por
            ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)
            RETURNING id`,
            ['Revisão Semestral do Gerador', 'Teste de carga e troca de filtros do gerador diesel.', eqGerador?.id || null, 'gerador', 'semestral', 15, JSON.stringify([{ item: 'Teste de partida automática', obrigatorio: true }, { item: 'Trocar filtro de óleo', obrigatorio: true }, { item: 'Trocar filtro de combustível', obrigatorio: true }, { item: 'Verificar nível de diesel', obrigatorio: true }, { item: 'Teste de carga por 30 min', obrigatorio: true }]), 1200.00, '2026-09-15', false, 'ativo', operationalCondoId, admin.id]
          );

          if (plano?.id && await tableExists(client, 'planos_execucoes')) {
            await ensureByKey(
              client,
              'SELECT id FROM planos_execucoes WHERE plano_id = $1 AND data_execucao = $2 LIMIT 1',
              [plano.id, '2026-03-05'],
              `INSERT INTO planos_execucoes (
                plano_id, data_execucao, executado_por, executado_por_nome, fornecedor_id, custo_real, itens_resultado, observacoes, status
              ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
              RETURNING id`,
              [plano.id, '2026-03-05', supervisor.id, supervisor.nome, fornecedor.id, 620.00, JSON.stringify([{ item: 'Checar cabos de aço', ok: true }, { item: 'Testar freio de emergência', ok: true }, { item: 'Lubrificar guias', ok: true }, { item: 'Verificar painel de comando', ok: true }]), 'Execução concluída sem pendências.', 'concluida']
            );
          }

          // ── Documentos Técnicos ──
          if (await tableExists(client, 'documentos_tecnicos')) {
            // Doc 1: Manual do elevador
            await ensureByKey(
              client,
              'SELECT id FROM documentos_tecnicos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
              [operationalCondoId, 'Manual do elevador'],
              `INSERT INTO documentos_tecnicos (
                titulo, descricao, tipo, status, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo,
                condominio_id, equipamento_id, fornecedor_id, plano_id, data_emissao, data_validade, tags, versao, observacoes, criado_por
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
              RETURNING id`,
              ['Manual do elevador', 'Manual técnico completo do elevador Otis Gen2.', 'manual', 'vigente', '/uploads/documentos/manual-elevador.pdf', 'manual-elevador.pdf', 102400, 'application/pdf', operationalCondoId, equipamento.id, fornecedor.id, plano?.id || null, '2025-01-10', '2027-01-10', ['manual', 'elevador'], '1.0', 'Arquivo fictício para testes.', admin.id]
            );

            // Doc 2: Certificado AVCB
            await ensureByKey(
              client,
              'SELECT id FROM documentos_tecnicos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
              [operationalCondoId, 'AVCB - Auto de Vistoria do Corpo de Bombeiros'],
              `INSERT INTO documentos_tecnicos (
                titulo, descricao, tipo, status, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo,
                condominio_id, data_emissao, data_validade, tags, versao, criado_por
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
              RETURNING id`,
              ['AVCB - Auto de Vistoria do Corpo de Bombeiros', 'Certificado de conformidade contra incêndio.', 'certificado', 'vigente', '/uploads/documentos/avcb-2025.pdf', 'avcb-2025.pdf', 256000, 'application/pdf', operationalCondoId, '2025-06-15', '2026-06-15', ['avcb', 'incêndio', 'bombeiros'], '1.0', admin.id]
            );

            // Doc 3: Laudo elétrico
            await ensureByKey(
              client,
              'SELECT id FROM documentos_tecnicos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
              [operationalCondoId, 'Laudo de Instalações Elétricas'],
              `INSERT INTO documentos_tecnicos (
                titulo, descricao, tipo, status, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo,
                condominio_id, fornecedor_id, data_emissao, data_validade, tags, versao, criado_por
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
              RETURNING id`,
              ['Laudo de Instalações Elétricas', 'Laudo técnico conforme NBR 5410.', 'laudo', 'vigente', '/uploads/documentos/laudo-eletrico.pdf', 'laudo-eletrico.pdf', 512000, 'application/pdf', operationalCondoId, fornecedor3?.id || null, '2025-09-01', '2026-09-01', ['laudo', 'elétrica', 'NBR5410'], '2.0', admin.id]
            );

            // Doc 4: Contrato (vencido)
            await ensureByKey(
              client,
              'SELECT id FROM documentos_tecnicos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
              [operationalCondoId, 'Contrato Limpeza de Caixa D\'Água'],
              `INSERT INTO documentos_tecnicos (
                titulo, descricao, tipo, status, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo,
                condominio_id, data_emissao, data_validade, tags, versao, criado_por
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
              RETURNING id`,
              ['Contrato Limpeza de Caixa D\'Água', 'Contrato de prestação de serviço semestral.', 'contrato', 'vencido', '/uploads/documentos/contrato-caixa-agua.pdf', 'contrato-caixa-agua.pdf', 89000, 'application/pdf', operationalCondoId, '2024-01-01', '2025-12-31', ['contrato', 'caixa d\'água'], '1.0', admin.id]
            );

            // Doc 5: ART
            await ensureByKey(
              client,
              'SELECT id FROM documentos_tecnicos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
              [operationalCondoId, 'ART - Reforma da Fachada'],
              `INSERT INTO documentos_tecnicos (
                titulo, descricao, tipo, status, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo,
                condominio_id, data_emissao, tags, versao, criado_por
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
              RETURNING id`,
              ['ART - Reforma da Fachada', 'Anotação de Responsabilidade Técnica da reforma.', 'art', 'vigente', '/uploads/documentos/art-fachada.pdf', 'art-fachada.pdf', 45000, 'application/pdf', operationalCondoId, '2026-02-10', ['art', 'fachada', 'reforma'], '1.0', admin.id]
            );
          }
        }

        if (await tableExists(client, 'fornecedores_contratos')) {
          await ensureByKey(
            client,
            'SELECT id FROM fornecedores_contratos WHERE fornecedor_id = $1 AND numero_contrato = $2 LIMIT 1',
            [fornecedor.id, 'CTR-EX-2026-01'],
            `INSERT INTO fornecedores_contratos (
              fornecedor_id, condominio_id, numero_contrato, descricao, valor, data_inicio, data_fim,
              renovacao_automatica, alerta_dias_antes, status, criado_por
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            RETURNING id`,
            [fornecedor.id, operationalCondoId, 'CTR-EX-2026-01', 'Contrato de manutenção preventiva dos elevadores.', 1850.00, '2026-01-01', '2026-12-31', true, 30, 'vigente', admin.id]
          );

          // Contrato 2
          if (fornecedor2?.id) {
            await ensureByKey(
              client,
              'SELECT id FROM fornecedores_contratos WHERE fornecedor_id = $1 AND numero_contrato = $2 LIMIT 1',
              [fornecedor2.id, 'CTR-EX-2026-02'],
              `INSERT INTO fornecedores_contratos (
                fornecedor_id, condominio_id, numero_contrato, descricao, valor, data_inicio, data_fim,
                renovacao_automatica, alerta_dias_antes, status, criado_por
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
              RETURNING id`,
              [fornecedor2.id, operationalCondoId, 'CTR-EX-2026-02', 'Contrato de manutenção do sistema hidráulico.', 980.00, '2026-02-01', '2027-01-31', true, 15, 'vigente', admin.id]
            );
          }
        }

        // Avaliações de fornecedores
        if (fornecedor?.id && await tableExists(client, 'fornecedores_avaliacoes')) {
          await ensureByKey(
            client,
            'SELECT id FROM fornecedores_avaliacoes WHERE fornecedor_id = $1 AND comentario = $2 LIMIT 1',
            [fornecedor.id, 'Atendimento rápido e profissional.'],
            `INSERT INTO fornecedores_avaliacoes (fornecedor_id, nota, comentario, avaliado_por)
             VALUES ($1,$2,$3,$4)
             RETURNING id`,
            [fornecedor.id, 5, 'Atendimento rápido e profissional.', supervisor.id]
          );
          await ensureByKey(
            client,
            'SELECT id FROM fornecedores_avaliacoes WHERE fornecedor_id = $1 AND comentario = $2 LIMIT 1',
            [fornecedor.id, 'Bom serviço, pequeno atraso na entrega de peças.'],
            `INSERT INTO fornecedores_avaliacoes (fornecedor_id, nota, comentario, avaliado_por)
             VALUES ($1,$2,$3,$4)
             RETURNING id`,
            [fornecedor.id, 4, 'Bom serviço, pequeno atraso na entrega de peças.', admin.id]
          );
        }
      }
    }

    // ── Mais Ordens de Serviço com custos ──
    await ensureByKey(
      client,
      'SELECT id FROM ordens_servico WHERE protocolo = $1 LIMIT 1',
      ['OS-EX-0002'],
      `INSERT INTO ordens_servico (
        protocolo, condominio_id, titulo, descricao, tipo, prioridade, status, local,
        responsavel_id, supervisor_id, observacoes, custo_material, custo_mao_obra, criado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id`,
      [
        'OS-EX-0002', operationalCondoId, 'Limpeza profunda do salão de festas',
        'Limpeza completa incluindo cadeiras, mesas, banheiros e cozinha.',
        'limpeza', 'media', 'concluida', 'Salão de Festas',
        funcionario.id, supervisor.id, 'Concluído em 4 horas.',
        85.00, 200.00, admin.id,
      ]
    );

    await ensureByKey(
      client,
      'SELECT id FROM ordens_servico WHERE protocolo = $1 LIMIT 1',
      ['OS-EX-0003'],
      `INSERT INTO ordens_servico (
        protocolo, condominio_id, titulo, descricao, tipo, prioridade, status, local,
        responsavel_id, observacoes, custo_material, custo_mao_obra, custo_terceiros, criado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id`,
      [
        'OS-EX-0003', operationalCondoId, 'Vazamento no banheiro do hall',
        'Vazamento detectado na tubulação do banheiro da área comum do térreo.',
        'emergencia', 'urgente', 'em_andamento', 'Hall Térreo - Banheiro',
        funcionario.id, 'Encanador acionado. Aguardando peça.',
        120.00, 350.00, 450.00, supervisor.id,
      ]
    );

    await ensureByKey(
      client,
      'SELECT id FROM ordens_servico WHERE protocolo = $1 LIMIT 1',
      ['OS-EX-0004'],
      `INSERT INTO ordens_servico (
        protocolo, condominio_id, titulo, descricao, tipo, prioridade, status, local,
        observacoes, data_previsao, criado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id`,
      [
        'OS-EX-0004', operationalCondoId, 'Pintura das vagas da garagem',
        'Repintar demarcação das vagas e sinalização horizontal da garagem subsolo.',
        'manutencao', 'baixa', 'aberta', 'Garagem Subsolo',
        'Orçamento aprovado pela assembleia.', '2026-04-10T10:00:00Z', admin.id,
      ]
    );

    await ensureByKey(
      client,
      'SELECT id FROM ordens_servico WHERE protocolo = $1 LIMIT 1',
      ['OS-EX-0005'],
      `INSERT INTO ordens_servico (
        protocolo, condominio_id, titulo, descricao, tipo, prioridade, status, local,
        responsavel_id, supervisor_id, custo_material, custo_terceiros, criado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id`,
      [
        'OS-EX-0005', operationalCondoId, 'Manutenção preventiva do gerador',
        'Troca de óleo e filtros do gerador diesel conforme plano semestral.',
        'preventiva', 'alta', 'aguardando', 'Casa de Máquinas',
        supervisor.id, null, 380.00, 800.00, admin.id,
      ]
    );

    // ── Mais Moradores ──
    const morador2 = await ensureByKey(
      client,
      'SELECT id FROM moradores WHERE email = $1 LIMIT 1',
      ['joao.exemplo@manutencaox.com.br'],
      `INSERT INTO moradores (nome, condominio_id, bloco, apartamento, whatsapp, email, perfil)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      ['João Oliveira', operationalCondoId, 'A', '101', '(19) 98888-2000', 'joao.exemplo@manutencaox.com.br', 'Proprietário']
    );

    await ensureByKey(
      client,
      'SELECT id FROM moradores WHERE email = $1 LIMIT 1',
      ['carla.exemplo@manutencaox.com.br'],
      `INSERT INTO moradores (nome, condominio_id, bloco, apartamento, whatsapp, email, perfil)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      ['Carla Santos', operationalCondoId, 'C', '502', '(19) 98888-3000', 'carla.exemplo@manutencaox.com.br', 'Inquilino']
    );

    await ensureByKey(
      client,
      'SELECT id FROM moradores WHERE email = $1 LIMIT 1',
      ['roberto.exemplo@manutencaox.com.br'],
      `INSERT INTO moradores (nome, condominio_id, bloco, apartamento, whatsapp, email, perfil)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      ['Roberto Lima', operationalCondoId, 'D', '301', '(19) 98888-4000', 'roberto.exemplo@manutencaox.com.br', 'Proprietário']
    );

    // ── Mais Materiais ──
    const material2 = await ensureByKey(
      client,
      'SELECT id FROM materiais WHERE protocolo = $1 LIMIT 1',
      ['MAT-EX-0002'],
      `INSERT INTO materiais (protocolo, nome, categoria, unidade, quantidade, quantidade_minima, custo_unitario, email_notificacao, condominio_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      ['MAT-EX-0002', 'Detergente Neutro 5L', 'Limpeza', 'un', 12, 5, 22.50, 'estoque@manutencaox.com.br', operationalCondoId]
    );

    await ensureByKey(
      client,
      'SELECT id FROM materiais WHERE protocolo = $1 LIMIT 1',
      ['MAT-EX-0003'],
      `INSERT INTO materiais (protocolo, nome, categoria, unidade, quantidade, quantidade_minima, custo_unitario, email_notificacao, condominio_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      ['MAT-EX-0003', 'Saco de Lixo 100L Reforçado', 'Descartáveis', 'pct', 8, 10, 14.90, 'estoque@manutencaox.com.br', operationalCondoId]
    );

    await ensureByKey(
      client,
      'SELECT id FROM materiais WHERE protocolo = $1 LIMIT 1',
      ['MAT-EX-0004'],
      `INSERT INTO materiais (protocolo, nome, categoria, unidade, quantidade, quantidade_minima, custo_unitario, email_notificacao, condominio_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      ['MAT-EX-0004', 'Cloro Granulado 10kg', 'Piscina', 'un', 3, 2, 89.00, 'estoque@manutencaox.com.br', operationalCondoId]
    );

    // ── Mais Movimentações de materiais ──
    if (material2?.id) {
      await ensureByKey(
        client,
        'SELECT id FROM materiais_movimentacoes WHERE material_id = $1 AND tipo = $2 AND quantidade = $3 AND observacao = $4 LIMIT 1',
        [material2.id, 'entrada', 20, 'Compra mensal de limpeza.'],
        `INSERT INTO materiais_movimentacoes (material_id, tipo, quantidade, observacao, funcionario_id, funcionario_nome)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [material2.id, 'entrada', 20, 'Compra mensal de limpeza.', admin.id, admin.nome]
      );
      await ensureByKey(
        client,
        'SELECT id FROM materiais_movimentacoes WHERE material_id = $1 AND tipo = $2 AND quantidade = $3 AND observacao = $4 LIMIT 1',
        [material2.id, 'saida', 8, 'Uso na limpeza semanal.'],
        `INSERT INTO materiais_movimentacoes (material_id, tipo, quantidade, observacao, funcionario_id, funcionario_nome)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [material2.id, 'saida', 8, 'Uso na limpeza semanal.', funcionario.id, funcionario.nome]
      );
    }

    // ── Mais Checklists ──
    await ensureByKey(
      client,
      'SELECT id FROM checklists WHERE condominio_id = $1 AND local = $2 AND data = $3 LIMIT 1',
      [operationalCondoId, 'Piscina e Área de Lazer', '2026-03-26'],
      `INSERT INTO checklists (condominio_id, local, tipo, itens, responsavel_id, supervisor_id, data, status, criado_por)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        operationalCondoId, 'Piscina e Área de Lazer', 'semanal',
        JSON.stringify([
          { id: 'chk-p1', item: 'Medir nível de cloro', concluido: true },
          { id: 'chk-p2', item: 'Verificar pH da água', concluido: true },
          { id: 'chk-p3', item: 'Limpar bordas', concluido: false },
          { id: 'chk-p4', item: 'Aspirar fundo da piscina', concluido: false },
          { id: 'chk-p5', item: 'Recolher espreguiçadeiras', concluido: true },
        ]),
        funcionario.id, supervisor.id, '2026-03-26', 'em_andamento', supervisor.id,
      ]
    );

    await ensureByKey(
      client,
      'SELECT id FROM checklists WHERE condominio_id = $1 AND local = $2 AND data = $3 LIMIT 1',
      [operationalCondoId, 'Hall Térreo e Corredores', '2026-03-26'],
      `INSERT INTO checklists (condominio_id, local, tipo, itens, responsavel_id, data, status, criado_por)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
       RETURNING id`,
      [
        operationalCondoId, 'Hall Térreo e Corredores', 'diaria',
        JSON.stringify([
          { id: 'chk-h1', item: 'Varrer piso', concluido: true },
          { id: 'chk-h2', item: 'Passar pano úmido', concluido: true },
          { id: 'chk-h3', item: 'Limpar espelhos', concluido: true },
          { id: 'chk-h4', item: 'Esvaziar lixeiras', concluido: true },
        ]),
        funcionario.id, '2026-03-26', 'concluido', supervisor.id,
      ]
    );

    // ── Mais Tarefas ──
    await ensureByKey(
      client,
      'SELECT id FROM tarefas_agendadas WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Regar jardim e vasos da entrada'],
      `INSERT INTO tarefas_agendadas (
        titulo, descricao, funcionario_id, funcionario_nome, condominio_id, local, recorrencia, dias_semana, criado_por, prioridade
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id`,
      ['Regar jardim e vasos da entrada', 'Regar todas as plantas do jardim frontal e vasos do hall.', funcionario.id, funcionario.nome, operationalCondoId, 'Jardim frontal', 'diaria', [1, 2, 3, 4, 5], supervisor.id, 'baixa']
    );

    await ensureByKey(
      client,
      'SELECT id FROM tarefas_agendadas WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Verificar extintores - mensal'],
      `INSERT INTO tarefas_agendadas (
        titulo, descricao, funcionario_id, funcionario_nome, condominio_id, local, recorrencia, dia_mes, criado_por, prioridade
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id`,
      ['Verificar extintores - mensal', 'Verificar validade e pressão de todos os extintores.', supervisor.id, supervisor.nome, operationalCondoId, 'Todos os andares', 'mensal', 1, admin.id, 'alta']
    );

    // ── Mais Escalas ──
    await ensureByKey(
      client,
      'SELECT id FROM escalas WHERE condominio_id = $1 AND funcionario_id = $2 AND dia_semana = $3 LIMIT 1',
      [operationalCondoId, funcionario.id, 1],
      `INSERT INTO escalas (condominio_id, funcionario_id, funcionario_nome, dia_semana, hora_inicio, hora_fim, local, funcao, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [operationalCondoId, funcionario.id, funcionario.nome, 1, '07:00', '16:00', 'Áreas comuns - Torre A e B', 'Manutenção', 'Segunda-feira - foco em manutenção elétrica.']
    );
    await ensureByKey(
      client,
      'SELECT id FROM escalas WHERE condominio_id = $1 AND funcionario_id = $2 AND dia_semana = $3 LIMIT 1',
      [operationalCondoId, funcionario.id, 2],
      `INSERT INTO escalas (condominio_id, funcionario_id, funcionario_nome, dia_semana, hora_inicio, hora_fim, local, funcao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [operationalCondoId, funcionario.id, funcionario.nome, 2, '07:00', '16:00', 'Piscina e Jardins', 'Limpeza']
    );
    await ensureByKey(
      client,
      'SELECT id FROM escalas WHERE condominio_id = $1 AND funcionario_id = $2 AND dia_semana = $3 LIMIT 1',
      [operationalCondoId, funcionario.id, 3],
      `INSERT INTO escalas (condominio_id, funcionario_id, funcionario_nome, dia_semana, hora_inicio, hora_fim, local, funcao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [operationalCondoId, funcionario.id, funcionario.nome, 3, '07:00', '16:00', 'Garagem e Casa de Máquinas', 'Manutenção']
    );

    // ── Mais Vencimentos ──
    await ensureByKey(
      client,
      'SELECT id FROM vencimentos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Seguro Predial - Renovação Anual'],
      `INSERT INTO vencimentos (titulo, tipo, descricao, condominio_id, data_vencimento, emails, avisos, qtd_notificacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
       RETURNING id`,
      ['Seguro Predial - Renovação Anual', 'contrato', 'Renovação anual da apólice de seguro predial.', operationalCondoId, '2026-05-30', ['operacional@manutencaox.com.br'], JSON.stringify([{ id: 'ven-s1', tipo: 'dias_antes', valor: 30 }, { id: 'ven-s2', tipo: 'dias_antes', valor: 7 }]), 0]
    );

    await ensureByKey(
      client,
      'SELECT id FROM vencimentos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Dedetização Semestral'],
      `INSERT INTO vencimentos (titulo, tipo, descricao, condominio_id, data_vencimento, emails, avisos, qtd_notificacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
       RETURNING id`,
      ['Dedetização Semestral', 'servico', 'Serviço de desinsetização e desratização.', operationalCondoId, '2026-04-20', ['operacional@manutencaox.com.br'], JSON.stringify([{ id: 'ven-d1', tipo: 'dias_antes', valor: 15 }]), 0]
    );

    await ensureByKey(
      client,
      'SELECT id FROM vencimentos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Recarga de Extintores'],
      `INSERT INTO vencimentos (titulo, tipo, descricao, condominio_id, data_vencimento, emails, avisos, qtd_notificacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
       RETURNING id`,
      ['Recarga de Extintores', 'servico', 'Recarga e teste hidrostático dos extintores.', operationalCondoId, '2026-07-01', ['operacional@manutencaox.com.br'], JSON.stringify([{ id: 'ven-e1', tipo: 'dias_antes', valor: 30 }]), 0]
    );

    // ── Mais Vistorias ──
    await ensureByKey(
      client,
      'SELECT id FROM vistorias WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Vistoria de segurança - Portaria'],
      `INSERT INTO vistorias (titulo, condominio_id, tipo, data, responsavel_id, responsavel_nome, status, itens)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       RETURNING id`,
      ['Vistoria de segurança - Portaria', operationalCondoId, 'rotina', '2026-03-25', supervisor.id, supervisor.nome, 'em_andamento', JSON.stringify([{ item: 'Câmeras funcionando', status: 'ok' }, { item: 'Interfone operacional', status: 'ok' }, { item: 'Portão automático', status: 'nao_conforme', obs: 'Sensor de presença com falha intermitente' }])]
    );

    // ── Mais Inspeções ──
    await ensureByKey(
      client,
      'SELECT id FROM inspecoes WHERE condominio_id = $1 AND tipo = $2 AND local = $3 LIMIT 1',
      [operationalCondoId, 'piscina', 'Área da Piscina'],
      `INSERT INTO inspecoes (condominio_id, tipo, local, inspetor_id, status, observacoes, itens_verificados)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING id`,
      [operationalCondoId, 'piscina', 'Área da Piscina', supervisor.id, 'conforme', 'Água dentro dos parâmetros.', JSON.stringify([{ item: 'pH entre 7.2 e 7.6', ok: true }, { item: 'Cloro adequado', ok: true }, { item: 'Bordas limpas', ok: true }, { item: 'Ralo de fundo limpo', ok: true }])]
    );

    await ensureByKey(
      client,
      'SELECT id FROM inspecoes WHERE condominio_id = $1 AND tipo = $2 AND local = $3 LIMIT 1',
      [operationalCondoId, 'garagem', 'Garagem Subsolo'],
      `INSERT INTO inspecoes (condominio_id, tipo, local, inspetor_id, status, observacoes, itens_verificados)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING id`,
      [operationalCondoId, 'garagem', 'Garagem Subsolo', supervisor.id, 'nao_conforme', 'Sinalização precisando de repintura.', JSON.stringify([{ item: 'Iluminação adequada', ok: true }, { item: 'Sinalização visível', ok: false, obs: 'Faixas desgastadas' }, { item: 'Extintores acessíveis', ok: true }, { item: 'Portão funcionando', ok: true }])]
    );

    // ── Mais Reportes ──
    await ensureByKey(
      client,
      'SELECT id FROM reportes WHERE protocolo = $1 LIMIT 1',
      ['REP-EX-0002'],
      `INSERT INTO reportes (protocolo, item_desc, descricao, status, prioridade, condominio_id, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      ['REP-EX-0002', 'Lâmpada queimada corredor 3º andar', 'Lâmpada LED do corredor próximo ao elevador.', 'aberto', 'baixa', operationalCondoId, funcionario.id]
    );

    await ensureByKey(
      client,
      'SELECT id FROM reportes WHERE protocolo = $1 LIMIT 1',
      ['REP-EX-0003'],
      `INSERT INTO reportes (protocolo, item_desc, descricao, status, prioridade, condominio_id, criado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      ['REP-EX-0003', 'Vazamento na torneira do jardim', 'Torneira do jardim frontal não fecha completamente.', 'em_analise', 'media', operationalCondoId, supervisor.id]
    );

    // ── Mais Comunicados ──
    await ensureByKey(
      client,
      'SELECT id FROM comunicados WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Horário da Piscina - Verão'],
      `INSERT INTO comunicados (tipo, titulo, mensagem, destinatario_tipo, condominio_id, emails_enviados, enviado_por, enviado_por_nome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      ['comunicado', 'Horário da Piscina - Verão', 'Informamos que a piscina funcionará das 7h às 22h durante o período de verão (outubro a março).', 'todos', operationalCondoId, ['moradora.exemplo@manutencaox.com.br', 'joao.exemplo@manutencaox.com.br'], admin.id, admin.nome]
    );

    // ── Mais Quadro Atividades ──
    await ensureByKey(
      client,
      'SELECT id FROM quadro_atividades WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Impermeabilização da laje'],
      `INSERT INTO quadro_atividades (
        titulo, descricao, status, prioridade, rotina, responsavel_id, responsavel_nome, condominio_id, criado_por, historico
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      RETURNING id`,
      ['Impermeabilização da laje', 'Aplicar manta asfáltica na laje da cobertura.', 'a_fazer', 'urgente', 'data_especifica', supervisor.id, supervisor.nome, operationalCondoId, admin.id, JSON.stringify([{ data: new Date().toISOString(), acao: 'Orçamento aprovado, aguardando agenda.' }])]
    );

    await ensureByKey(
      client,
      'SELECT id FROM quadro_atividades WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Trocar lâmpadas do estacionamento'],
      `INSERT INTO quadro_atividades (
        titulo, descricao, status, prioridade, rotina, responsavel_id, responsavel_nome, condominio_id, criado_por, historico
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      RETURNING id`,
      ['Trocar lâmpadas do estacionamento', 'Substituir 12 lâmpadas por LED no estacionamento.', 'concluido', 'media', 'semanal', funcionario.id, funcionario.nome, operationalCondoId, admin.id, JSON.stringify([{ data: new Date().toISOString(), acao: 'Concluído - todas trocadas.' }])]
    );

    // ── Mais Roteiros ──
    await ensureByKey(
      client,
      'SELECT id FROM roteiros WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
      [operationalCondoId, 'Procedimento de emergência - Falta de água'],
      `INSERT INTO roteiros (titulo, descricao, categoria, passos, condominio_id, criado_por)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6)
       RETURNING id`,
      ['Procedimento de emergência - Falta de água', 'Passo a passo para quando o condomínio ficar sem abastecimento.', 'emergencia', JSON.stringify([{ ordem: 1, titulo: 'Verificar nível do reservatório' }, { ordem: 2, titulo: 'Checar se bomba de recalque está ligada' }, { ordem: 3, titulo: 'Contatar concessionária' }, { ordem: 4, titulo: 'Comunicar moradores' }]), operationalCondoId, admin.id]
    );

    // ── Mais Notificações ──
    await ensureByKey(
      client,
      'SELECT id FROM notificacoes WHERE user_id = $1 AND titulo = $2 LIMIT 1',
      [supervisor.id, 'Nova OS urgente atribuída'],
      `INSERT INTO notificacoes (user_id, titulo, mensagem, tipo, link)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [supervisor.id, 'Nova OS urgente atribuída', 'Vazamento no banheiro do hall - prioridade urgente.', 'warning', '/ordens-servico']
    );

    await ensureByKey(
      client,
      'SELECT id FROM notificacoes WHERE user_id = $1 AND titulo = $2 LIMIT 1',
      [admin.id, 'Vencimento próximo: Contrato do Elevador'],
      `INSERT INTO notificacoes (user_id, titulo, mensagem, tipo, link)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [admin.id, 'Vencimento próximo: Contrato do Elevador', 'O contrato vence em 20 dias. Providencie a renovação.', 'info', '/vencimentos']
    );

    await ensureByKey(
      client,
      'SELECT id FROM notificacoes WHERE user_id = $1 AND titulo = $2 LIMIT 1',
      [funcionario.id, 'Checklist pendente para hoje'],
      `INSERT INTO notificacoes (user_id, titulo, mensagem, tipo, link)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
      [funcionario.id, 'Checklist pendente para hoje', 'Você tem 1 checklist da piscina pendente para hoje.', 'info', '/checklists']
    );

    // ── Mais Audit Logs ──
    await ensureByKey(
      client,
      'SELECT id FROM audit_logs WHERE user_id = $1 AND acao = $2 AND entidade = $3 LIMIT 1',
      [admin.id, 'criar_os', 'ordens_servico'],
      `INSERT INTO audit_logs (user_id, user_nome, user_role, acao, entidade, detalhes, ip)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       RETURNING id`,
      [admin.id, admin.nome, admin.role, 'criar_os', 'ordens_servico', JSON.stringify({ protocolo: 'OS-EX-0001', titulo: 'Troca de iluminação da garagem' }), '192.168.1.100']
    );

    await ensureByKey(
      client,
      'SELECT id FROM audit_logs WHERE user_id = $1 AND acao = $2 AND entidade = $3 LIMIT 1',
      [supervisor.id, 'concluir_checklist', 'checklists'],
      `INSERT INTO audit_logs (user_id, user_nome, user_role, acao, entidade, detalhes, ip)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       RETURNING id`,
      [supervisor.id, supervisor.nome, supervisor.role, 'concluir_checklist', 'checklists', JSON.stringify({ local: 'Casa de Máquinas' }), '192.168.1.101']
    );

    // ── Mais Geolocalização ──
    await ensureByKey(
      client,
      'SELECT id FROM geolocalizacao WHERE user_id = $1 AND data = $2 AND funcao_id = $3 LIMIT 1',
      [funcionarioDois.id, '2026-03-26', 'portaria'],
      `INSERT INTO geolocalizacao (user_id, latitude, longitude, endereco, hora_chegada, tempo_total, data, funcao_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [funcionarioDois.id, -22.9105, -47.0622, 'Portaria principal', '2026-03-26T07:00:00Z', 540, '2026-03-26', 'portaria']
    );

    // ── Controle de Ponto (saída do funcionário 2) ──
    await ensureByKey(
      client,
      'SELECT id FROM controle_ponto WHERE funcionario_id = $1 AND tipo = $2 LIMIT 1',
      [funcionarioDois.id, 'saida'],
      `INSERT INTO controle_ponto (
        funcionario_id, funcionario_nome, funcionario_email, funcionario_cargo, tipo, latitude, longitude, endereco, permanencia
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id`,
      [funcionarioDois.id, funcionarioDois.nome, funcionarioDois.email, 'Porteiro', 'saida', -22.9105, -47.0622, 'Portaria principal', '09h00']
    );

    // ── Ponto para funcionário principal ──
    await ensureByKey(
      client,
      'SELECT id FROM controle_ponto WHERE funcionario_id = $1 AND tipo = $2 LIMIT 1',
      [funcionario.id, 'entrada'],
      `INSERT INTO controle_ponto (
        funcionario_id, funcionario_nome, funcionario_email, funcionario_cargo, tipo, latitude, longitude, endereco
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id`,
      [funcionario.id, funcionario.nome, funcionario.email, 'Auxiliar de Manutenção', 'entrada', -22.9099, -47.0626, 'Área de Manutenção']
    );

    if (morador?.id && await tableExists(client, 'solicitacoes_morador')) {
      await ensureByKey(
        client,
        'SELECT id FROM solicitacoes_morador WHERE protocolo = $1 LIMIT 1',
        ['SOL-EX-0001'],
        `INSERT INTO solicitacoes_morador (
          protocolo, morador_id, condominio_id, tipo, titulo, descricao, local, status, respondido_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id`,
        ['SOL-EX-0001', morador.id, operationalCondoId, 'manutencao', 'Vazamento no hall', 'Há um vazamento no teto do hall próximo ao elevador do bloco B.', 'Hall do bloco B', 'em_analise', supervisor.id]
      );

      // Solicitação 2 - reclamação
      await ensureByKey(
        client,
        'SELECT id FROM solicitacoes_morador WHERE protocolo = $1 LIMIT 1',
        ['SOL-EX-0002'],
        `INSERT INTO solicitacoes_morador (
          protocolo, morador_id, condominio_id, tipo, titulo, descricao, local, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING id`,
        ['SOL-EX-0002', morador.id, operationalCondoId, 'reclamacao', 'Barulho excessivo no salão de festas', 'Festa até 3h da manhã no último sábado. Peço providências.', 'Salão de Festas', 'aberta']
      );

      // Solicitação 3 - sugestão (outro morador)
      if (morador2?.id) {
        await ensureByKey(
          client,
          'SELECT id FROM solicitacoes_morador WHERE protocolo = $1 LIMIT 1',
          ['SOL-EX-0003'],
          `INSERT INTO solicitacoes_morador (
            protocolo, morador_id, condominio_id, tipo, titulo, descricao, local, status, respondido_por
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING id`,
          ['SOL-EX-0003', morador2.id, operationalCondoId, 'sugestao', 'Instalar bicicletário coberto', 'Sugiro a instalação de um bicicletário coberto na garagem para incentivar o uso de bicicletas.', 'Garagem', 'resolvida', admin.id]
        );
      }
    }

    if (await tableExists(client, 'sla_configuracoes')) {
      const priorities = [
        ['urgente', 2, 12],
        ['alta', 4, 24],
        ['media', 8, 48],
        ['baixa', 24, 120],
      ] as const;

      for (const [priority, responseHours, resolutionHours] of priorities) {
        await ensureByKey(
          client,
          'SELECT id FROM sla_configuracoes WHERE condominio_id = $1 AND prioridade = $2 LIMIT 1',
          [operationalCondoId, priority],
          `INSERT INTO sla_configuracoes (condominio_id, prioridade, tempo_resposta_horas, tempo_resolucao_horas, criado_por)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id`,
          [operationalCondoId, priority, responseHours, resolutionHours, admin.id]
        );
      }
    }

    if (await tableExists(client, 'whatsapp_config')) {
      await ensureByKey(
        client,
        'SELECT id FROM whatsapp_config WHERE condominio_id = $1 LIMIT 1',
        [operationalCondoId],
        `INSERT INTO whatsapp_config (
          condominio_id, api_url, api_token, numero_remetente, ativo,
          notificar_os_criada, notificar_os_concluida, notificar_vencimentos, notificar_comunicados
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id`,
        [operationalCondoId, 'https://api.exemplo-whatsapp.local', 'token-exemplo', '5511999999999', false, true, true, true, true]
      );
    }

    if (await tableExists(client, 'whatsapp_mensagens')) {
      await ensureByKey(
        client,
        'SELECT id FROM whatsapp_mensagens WHERE condominio_id = $1 AND destinatario = $2 AND mensagem = $3 LIMIT 1',
        [operationalCondoId, '5519988881000', 'Olá! Sua solicitação de manutenção (SOL-EX-0001) foi recebida e está em análise.'],
        `INSERT INTO whatsapp_mensagens (condominio_id, destinatario, mensagem, tipo, status, enviado_em)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [operationalCondoId, '5519988881000', 'Olá! Sua solicitação de manutenção (SOL-EX-0001) foi recebida e está em análise.', 'texto', 'enviado', '2026-03-26T09:00:00Z']
      );

      await ensureByKey(
        client,
        'SELECT id FROM whatsapp_mensagens WHERE condominio_id = $1 AND destinatario = $2 AND mensagem = $3 LIMIT 1',
        [operationalCondoId, '5519988882000', 'Comunicado: A piscina funcionará até 22h no período de verão. Boa temporada!'],
        `INSERT INTO whatsapp_mensagens (condominio_id, destinatario, mensagem, tipo, status, enviado_em)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [operationalCondoId, '5519988882000', 'Comunicado: A piscina funcionará até 22h no período de verão. Boa temporada!', 'texto', 'enviado', '2026-03-25T14:30:00Z']
      );

      await ensureByKey(
        client,
        'SELECT id FROM whatsapp_mensagens WHERE condominio_id = $1 AND destinatario = $2 AND mensagem = $3 LIMIT 1',
        [operationalCondoId, '5519988883000', 'Lembrete: O seguro predial vence em 30 dias. Providencie a renovação.'],
        `INSERT INTO whatsapp_mensagens (condominio_id, destinatario, mensagem, tipo, status, enviado_em)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [operationalCondoId, '5519988883000', 'Lembrete: O seguro predial vence em 30 dias. Providencie a renovação.', 'texto', 'pendente', null]
      );
    }

    if (await tableExists(client, 'orcamentos')) {
      const orcamento = await ensureByKey(
        client,
        'SELECT id FROM orcamentos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
        [operationalCondoId, 'Orçamento de pintura do hall'],
        `INSERT INTO orcamentos (
          condominio_id, titulo, cliente_nome, cliente_telefone, cliente_email, descricao_geral,
          condicoes_pagamento, validade_dias, prazo_execucao, status, valor_total, valor_final, criado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id`,
        [operationalCondoId, 'Orçamento de pintura do hall', 'Condomínio Exemplo Operacional', '(19) 4000-2000', 'operacional@manutencaox.com.br', 'Pintura completa do hall de entrada incluindo paredes, teto e rodapés. Tinta acrílica premium, 2 demãos.', '30% entrada / 70% entrega', 15, '7 dias úteis', 'enviado', 3500.00, 3500.00, admin.id]
      );

      if (orcamento?.id && await tableExists(client, 'orcamento_itens')) {
        await ensureByKey(
          client,
          'SELECT id FROM orcamento_itens WHERE orcamento_id = $1 AND descricao = $2 LIMIT 1',
          [orcamento.id, 'Pintura acrílica premium'],
          `INSERT INTO orcamento_itens (orcamento_id, descricao, tipo, quantidade, unidade, valor_unitario, valor_total, ordem)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id`,
          [orcamento.id, 'Pintura acrílica premium', 'servico', 1, 'serviço', 2800.00, 2800.00, 1]
        );
        await ensureByKey(
          client,
          'SELECT id FROM orcamento_itens WHERE orcamento_id = $1 AND descricao = $2 LIMIT 1',
          [orcamento.id, 'Tinta Suvinil Acrílica 18L (Branco Neve)'],
          `INSERT INTO orcamento_itens (orcamento_id, descricao, tipo, quantidade, unidade, valor_unitario, valor_total, ordem)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id`,
          [orcamento.id, 'Tinta Suvinil Acrílica 18L (Branco Neve)', 'material', 2, 'lata', 350.00, 700.00, 2]
        );
      }

      if (orcamento?.id && await tableExists(client, 'orcamento_fotos')) {
        await ensureByKey(
          client,
          'SELECT id FROM orcamento_fotos WHERE orcamento_id = $1 AND url = $2 LIMIT 1',
          [orcamento.id, '/uploads/fotos/orcamento-exemplo.jpg'],
          `INSERT INTO orcamento_fotos (orcamento_id, url, legenda, ordem)
           VALUES ($1,$2,$3,$4)
           RETURNING id`,
          [orcamento.id, '/uploads/fotos/orcamento-exemplo.jpg', 'Foto de referência do hall', 1]
        );
      }

      // ── Segundo Orçamento ──
      const orcamento2 = await ensureByKey(
        client,
        'SELECT id FROM orcamentos WHERE condominio_id = $1 AND titulo = $2 LIMIT 1',
        [operationalCondoId, 'Orçamento de troca do portão automático'],
        `INSERT INTO orcamentos (
          condominio_id, titulo, cliente_nome, cliente_telefone, cliente_email, descricao_geral,
          condicoes_pagamento, validade_dias, prazo_execucao, status, valor_total, valor_final, criado_por
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id`,
        [operationalCondoId, 'Orçamento de troca do portão automático', 'Condomínio Exemplo Operacional', '(19) 4000-2000', 'operacional@manutencaox.com.br', 'Fornecimento e instalação de portão deslizante industrial com motor PPA.', 'À vista com 5% de desconto', 10, '15 dias úteis', 'rascunho', 8500.00, 8075.00, admin.id]
      );

      if (orcamento2?.id && await tableExists(client, 'orcamento_itens')) {
        await ensureByKey(
          client,
          'SELECT id FROM orcamento_itens WHERE orcamento_id = $1 AND descricao = $2 LIMIT 1',
          [orcamento2.id, 'Portão deslizante 5m aço galvanizado'],
          `INSERT INTO orcamento_itens (orcamento_id, descricao, tipo, quantidade, unidade, valor_unitario, valor_total, ordem)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id`,
          [orcamento2.id, 'Portão deslizante 5m aço galvanizado', 'material', 1, 'un', 4500.00, 4500.00, 1]
        );
        await ensureByKey(
          client,
          'SELECT id FROM orcamento_itens WHERE orcamento_id = $1 AND descricao = $2 LIMIT 1',
          [orcamento2.id, 'Motor PPA DZ Rio 800 KG'],
          `INSERT INTO orcamento_itens (orcamento_id, descricao, tipo, quantidade, unidade, valor_unitario, valor_total, ordem)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id`,
          [orcamento2.id, 'Motor PPA DZ Rio 800 KG', 'material', 1, 'un', 1800.00, 1800.00, 2]
        );
        await ensureByKey(
          client,
          'SELECT id FROM orcamento_itens WHERE orcamento_id = $1 AND descricao = $2 LIMIT 1',
          [orcamento2.id, 'Mão de obra instalação'],
          `INSERT INTO orcamento_itens (orcamento_id, descricao, tipo, quantidade, unidade, valor_unitario, valor_total, ordem)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id`,
          [orcamento2.id, 'Mão de obra instalação', 'servico', 1, 'serviço', 2200.00, 2200.00, 3]
        );
      }
    }

    await client.query('COMMIT');

    console.log('Exemplos criados/atualizados com sucesso.');
    console.log(`Senha padrão dos usuários de exemplo: ${examplePassword}`);
    console.log(`Master: ${master.email}`);
    console.log('Administrador: admin.exemplo@manutencaox.com.br');
    console.log('Supervisor: supervisor.exemplo@manutencaox.com.br');
    console.log('Funcionário: funcionario.exemplo@manutencaox.com.br');
    console.log('Funcionário apoio: funcionario2.exemplo@manutencaox.com.br');
    console.log(`Condomínios de exemplo: ${masterCondoId} e ${operationalCondoId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createExamples().catch((error) => {
  console.error('Erro ao criar exemplos:', error);
  process.exit(1);
});