import type { UserRole } from '../types';

const DEMO_DATA_VERSION = 6;

const DEMO_TEXT_REPLACEMENTS: Array<[string, string]> = [
  ['S�o', 'São'],
  ['Edif�cio', 'Edifício'],
  ['Condom�nio', 'Condomínio'],
  ['Ip�s', 'Ipês'],
  ['tubula��o', 'tubulação'],
  ['qu�mico', 'químico'],
  ['�rea', 'área'],
  ['�reas', 'áreas'],
  ['�rvore', 'árvore'],
  ['�rvores', 'árvores'],
  ['l�mpada', 'lâmpada'],
  ['l�mpadas', 'lâmpadas'],
  ['T�cnico', 'Técnico'],
  ['t�cnico', 'técnico'],
  ['Conclu�do', 'Concluído'],
  ['pend�ncias', 'pendências'],
  ['Manuten��o', 'Manutenção'],
  ['manuten��o', 'manutenção'],
  ['ru�do', 'ruído'],
  ['�mido', 'úmido'],
  ['ilumina��o', 'iluminação'],
  ['recep��o', 'recepção'],
  ['Desinsetiza��o', 'Desinsetização'],
  ['desinsetiza��o', 'desinsetização'],
  ['Funcion�rio', 'Funcionário'],
  ['Reposi��o', 'Reposição'],
  ['Inspe��o', 'Inspeção'],
  ['Descart�veis', 'Descartáveis'],
  ['Higi�nico', 'Higiênico'],
  ['El�trica', 'Elétrica'],
  ['Movimenta��es', 'Movimentações'],
  ['Servi�o', 'Serviço'],
  ['servi�o', 'serviço'],
  ['Propriet�rio', 'Proprietário'],
  ['ficar�', 'ficará'],
  ['mar�o', 'março'],
  ['Ordin�ria', 'Ordinária'],
  ['cond�minos', 'condôminos'],
  ['ordin�ria', 'ordinária'],
  ['sal�o', 'salão'],
  ['Sal�o', 'Salão'],
  ['c�meras', 'câmeras'],
  ['Instala��o', 'Instalação'],
  ['corrim�os', 'corrimãos'],
  ['port�o', 'portão'],
  ['Execu��es', 'Execuções'],
  ['Verifica��o', 'Verificação'],
  ['n�vel', 'nível'],
  ['m�veis', 'móveis'],
  ['sPiso Molhados', 'Piso Molhado'],
  ['sinaliza��o', 'sinalização'],
  ['m�quina', 'máquina'],
  ['press�o', 'pressão'],
  ['sof�s', 'sofás'],
  ['L�mpada', 'Lâmpada'],
  ['Infiltra��o', 'Infiltração'],
  ['Bot�es', 'Botões'],
  ['Formul�rios', 'Formulários'],
  ['Avalia��o', 'Avaliação'],
  ['Formul�rio', 'Formulário'],
  ['voc�', 'você'],
  ['Observa��es', 'Observações'],
  ['Ocorr�ncia', 'Ocorrência'],
  ['N�vel', 'Nível'],
  ['3�', '3º'],
  ['1�', '1º'],
  ['5�', '5º'],
  ['10�', '10º'],
  ['�s', 'às'],
];

function normalizeDemoValue<T>(value: T): T {
  if (typeof value === 'string') {
    return DEMO_TEXT_REPLACEMENTS.reduce<string>((text, [from, to]) => text.split(from).join(to), value) as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => normalizeDemoValue(item)) as T;
  }

  if (value && typeof value === 'object') {
    const normalizedEntries = Object.entries(value).map(([key, currentValue]) => [key, normalizeDemoValue(currentValue)]);
    return Object.fromEntries(normalizedEntries) as T;
  }

  return value;
}

function setNormalizedDemoItem(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(normalizeDemoValue(value)));
}

// Clear all demo-seeded localStorage keys (including legacy wrong keys)
export function clearDemoData() {
  const keys = [
    'manutencao-condominios', 'manutencao-ordens-servico', 'manutencao-os',
    'manutencao-checklists', 'manutencao-tarefas', 'manutencao_tarefas_agendadas',
    'manutencao_tarefas_execucoes', 'manutencao-materiais', 'manutencao-movimentacoes',
    'manutencao-materiais-movimentacoes', 'manutencao-escalas', 'manutencao-vencimentos',
    'manutencao-vencimentos-emails', 'manutencao-moradores', 'manutencao-comunicados',
    'manutencao-quadro-atividades', 'manutencao-quadro-permissoes', 'manutencao-vistorias',
    'manutencao-roteiros', 'manutencao_roteiros_execucao', 'manutencao_roteiros_exec_log',
    'manutencao-reportes', 'manutencao-whats-contatos', 'manutencao-inspecoes',
    'manutencao-qrcodes', 'manutencao-controle-ponto',
    'manutencao-equipamentos', 'manutencao-fornecedores', 'manutencao-planos-manutencao',
    'manutencao-documentos', 'manutencao-solicitacoes', 'manutencao-sla-configs',
    'manutencao-orcamentos', 'manutencao-geolocalizacao', 'manutencao-notificacoes',
  ];
  keys.forEach(k => localStorage.removeItem(k));
}

// Seed demo data into localStorage for demo mode
export function seedDemoData() {
  const demoKeys = [
    'manutencao-condominios', 'manutencao-ordens-servico', 'manutencao-checklists', 'manutencao_tarefas_agendadas',
    'manutencao_tarefas_execucoes', 'manutencao-materiais', 'manutencao-materiais-movimentacoes', 'manutencao-escalas',
    'manutencao-vencimentos', 'manutencao-moradores', 'manutencao-comunicados', 'manutencao-quadro-atividades',
    'manutencao-vistorias', 'manutencao_roteiros_execucao', 'manutencao_roteiros_exec_log', 'manutencao-reportes',
    'manutencao-inspecoes', 'manutencao-qrcodes', 'manutencao-equipamentos', 'manutencao-fornecedores',
    'manutencao-planos-manutencao', 'manutencao-documentos', 'manutencao-solicitacoes', 'manutencao-controle-ponto',
  ];

  const currentVersion = Number(localStorage.getItem('manutencao_demo_version') || '0');
  if (currentVersion < DEMO_DATA_VERSION) {
    clearDemoData();
    localStorage.setItem('manutencao_demo_version', String(DEMO_DATA_VERSION));
  }
  const now = Date.now();
  const day = 86400000;
  const agora = new Date().toISOString();
  const dataHoje = agora.slice(0, 10);

  // Condominios
  if (!localStorage.getItem('manutencao-condominios')) {
    setNormalizedDemoItem('manutencao-condominios', [
      { id: 'c1', nome: 'Residencial Aurora', endereco: 'Rua das Flores, 500', cidade: 'S�o Paulo', blocos: 3, unidades: 120, sindico: 'Carlos Mendes', telefone: '(11) 99999-0001', email: 'aurora@cond.com' },
      { id: 'c2', nome: 'Edif�cio Central Park', endereco: 'Av Paulista, 1500', cidade: 'S�o Paulo', blocos: 1, unidades: 60, sindico: 'Ana Oliveira', telefone: '(11) 99999-0002', email: 'centralpark@cond.com' },
      { id: 'c3', nome: 'Condom�nio Vila Verde', endereco: 'Rua dos Ip�s, 200', cidade: 'S�o Paulo', blocos: 2, unidades: 80, sindico: 'Roberto Lima', telefone: '(11) 99999-0003', email: 'vilaverde@cond.com' },
    ]);
  }

  // Ordens de Serviço (key: manutencao-ordens-servico)
  if (!localStorage.getItem('manutencao-ordens-servico')) {
    localStorage.setItem('manutencao-ordens-servico', JSON.stringify([
      { id: 'OS-001', protocolo: 'OS-260301-4821', condominioId: 'c1', titulo: 'Vazamento no Bloco A', descricao: 'Vazamento na tubula��o do 3� andar, apartamento 302', tipo: 'emergencia', prioridade: 'alta', status: 'em_andamento', local: 'Bloco A - 3� Andar', responsavelId: 'demo-func', fotos: [], observacoes: 'T�cnico a caminho', dataAbertura: now - 2 * day, criadoPor: 'demo-admin' },
      { id: 'OS-002', protocolo: 'OS-260302-1532', condominioId: 'c1', titulo: 'Limpeza da piscina', descricao: 'Limpeza completa e tratamento qu�mico da piscina', tipo: 'limpeza', prioridade: 'media', status: 'aberta', local: '�rea de Lazer', responsavelId: 'demo-func', fotos: [], observacoes: '', dataAbertura: now - day, criadoPor: 'demo-sup' },
      { id: 'OS-003', protocolo: 'OS-260303-7294', condominioId: 'c1', titulo: 'Troca de l�mpadas - Garagem', descricao: 'Substituir 5 l�mpadas queimadas na garagem B1', tipo: 'manutencao', prioridade: 'baixa', status: 'concluida', local: 'Garagem B1', responsavelId: 'demo-func', fotos: [], observacoes: 'Conclu�do sem pend�ncias', dataAbertura: now - 5 * day, dataConclusao: now - 3 * day, criadoPor: 'demo-admin' },
      { id: 'OS-004', protocolo: 'OS-260304-3847', condominioId: 'c2', titulo: 'Pintura do hall de entrada', descricao: 'Repintar paredes e teto do hall principal', tipo: 'manutencao', prioridade: 'media', status: 'aberta', local: 'Hall de Entrada', fotos: [], observacoes: '', dataAbertura: now - day, criadoPor: 'demo-admin' },
      { id: 'OS-005', protocolo: 'OS-260305-9156', condominioId: 'c1', titulo: 'Manuten��o do elevador', descricao: 'Elevador social com ru�do anormal - solicitar t�cnico', tipo: 'preventiva', prioridade: 'alta', status: 'em_andamento', local: 'Elevador Social', responsavelId: 'demo-sup', fotos: [], observacoes: 'T�cnico agendado', dataAbertura: now - 3 * day, criadoPor: 'demo-admin' },
    ]));
  }

  // Checklists
  if (!localStorage.getItem('manutencao-checklists')) {
    localStorage.setItem('manutencao-checklists', JSON.stringify([
      { id: 'CK-001', condominioId: 'c1', local: 'Hall de Entrada - Bloco A', tipo: 'diaria', itens: [{ id: '1', descricao: 'Varrer piso', concluido: true }, { id: '2', descricao: 'Passar pano �mido', concluido: true }, { id: '3', descricao: 'Limpar vidros da porta', concluido: false }, { id: '4', descricao: 'Esvaziar lixeiras', concluido: true }], responsavelId: 'demo-func', data: dataHoje, horaInicio: now - 7200000, status: 'em_andamento', criadoPor: 'demo-sup', criadoEm: now - 5 * day },
      { id: 'CK-002', condominioId: 'c1', local: 'Garagem Subsolo', tipo: 'semanal', itens: [{ id: '5', descricao: 'Varrer toda a �rea', concluido: false }, { id: '6', descricao: 'Recolher lixo', concluido: false }, { id: '7', descricao: 'Verificar ilumina��o', concluido: false }], responsavelId: 'demo-func', data: dataHoje, status: 'pendente', criadoPor: 'demo-sup', criadoEm: now - 3 * day },
      { id: 'CK-003', condominioId: 'c1', local: 'Sal�o de Festas', tipo: 'semanal', itens: [{ id: '8', descricao: 'Limpar mesas e cadeiras', concluido: true }, { id: '9', descricao: 'Higienizar banheiros', concluido: true }, { id: '10', descricao: 'Aspirar tapetes', concluido: true }], responsavelId: 'demo-func', data: new Date(now - 1 * day).toISOString().slice(0, 10), status: 'concluido', criadoPor: 'demo-sup', criadoEm: now - 7 * day },
    ]));
  }

  // Tarefas Agendadas (key: manutencao_tarefas_agendadas)
  if (!localStorage.getItem('manutencao_tarefas_agendadas')) {
    localStorage.setItem('manutencao_tarefas_agendadas', JSON.stringify([
      { id: 't1', titulo: 'Regar plantas da recep��o', descricao: 'Regar todas as plantas do hall e recep��o', funcionarioId: 'demo-func', funcionarioNome: 'Funcion�rio Demo', condominio: 'Residencial Aurora', bloco: 'A', local: 'Hall de Entrada', recorrencia: 'diaria', diasSemana: [1, 2, 3, 4, 5], criadoPor: 'demo-sup', criadoEm: new Date(now - day).toISOString(), prioridade: 'baixa' },
      { id: 't2', titulo: 'Desinsetiza��o Bloco B', descricao: 'Acompanhar equipe de desinsetiza��o', funcionarioId: 'demo-sup', funcionarioNome: 'Supervisor Demo', condominio: 'Residencial Aurora', bloco: 'B', local: 'Todos os andares', recorrencia: 'unica', dataEspecifica: new Date(now + day).toISOString().slice(0, 10), diasSemana: [], criadoPor: 'demo-admin', criadoEm: new Date(now - 3 * day).toISOString(), prioridade: 'alta' },
      { id: 't3', titulo: 'Verificar extintores', descricao: 'Verificar validade de todos os extintores', funcionarioId: 'demo-func', funcionarioNome: 'Funcion�rio Demo', condominio: 'Residencial Aurora', bloco: '', local: 'Todos os blocos', recorrencia: 'mensal', diaMes: 15, diasSemana: [], criadoPor: 'demo-admin', criadoEm: new Date(now - 10 * day).toISOString(), prioridade: 'media' },
      { id: 't4', titulo: 'Limpeza das escadas Bloco A', descricao: 'Varrer e passar pano em todas as escadas do Bloco A', funcionarioId: 'demo-func', funcionarioNome: 'Funcion�rio Demo', condominio: 'Residencial Aurora', bloco: 'A', local: 'Escadas', recorrencia: 'semanal', diasSemana: [1, 3, 5], criadoPor: 'demo-sup', criadoEm: new Date(now - 5 * day).toISOString(), prioridade: 'media' },
      { id: 't5', titulo: 'Reposi��o de papel higi�nico', descricao: 'Verificar e repor papel higi�nico em todos os banheiros comuns', funcionarioId: 'demo-func', funcionarioNome: 'Funcion�rio Demo', condominio: 'Residencial Aurora', bloco: '', local: 'Banheiros comuns', recorrencia: 'diaria', diasSemana: [1, 2, 3, 4, 5, 6], criadoPor: 'demo-sup', criadoEm: new Date(now - 2 * day).toISOString(), prioridade: 'alta' },
      { id: 't6', titulo: 'Inspe��o do playground', descricao: 'Verificar brinquedos, piso e cercas do playground', funcionarioId: 'demo-sup', funcionarioNome: 'Supervisor Demo', condominio: 'Residencial Aurora', bloco: '', local: 'Playground', recorrencia: 'semanal', diasSemana: [2, 5], criadoPor: 'demo-admin', criadoEm: new Date(now - 7 * day).toISOString(), prioridade: 'media' },
    ]));
  }

  // Tarefas Execu��es
  if (!localStorage.getItem('manutencao_tarefas_execucoes')) {
    localStorage.setItem('manutencao_tarefas_execucoes', JSON.stringify([
      { id: 'exec1', tarefaId: 't1', funcionarioId: 'demo-func', funcionarioNome: 'Funcion�rio Demo', status: 'realizada', fotos: [], observacao: 'Plantas regadas conforme rotina', dataExecucao: new Date(now - day).toISOString().slice(0, 10), horaExecucao: '08:15' },
      { id: 'exec2', tarefaId: 't4', funcionarioId: 'demo-func', funcionarioNome: 'Funcion�rio Demo', status: 'realizada', fotos: [], observacao: 'Escadas varridas e limpas', dataExecucao: new Date(now - day).toISOString().slice(0, 10), horaExecucao: '09:30' },
      { id: 'exec3', tarefaId: 't5', funcionarioId: 'demo-func', funcionarioNome: 'Funcion�rio Demo', status: 'realizada', fotos: [], observacao: 'Papel higi�nico reposto em todos os banheiros', dataExecucao: new Date(now - day).toISOString().slice(0, 10), horaExecucao: '10:00' },
      { id: 'exec4', tarefaId: 't1', funcionarioId: 'demo-func', funcionarioNome: 'Funcion�rio Demo', status: 'realizada', fotos: [], observacao: '', dataExecucao: new Date(now - 2 * day).toISOString().slice(0, 10), horaExecucao: '07:45' },
      { id: 'exec5', tarefaId: 't5', funcionarioId: 'demo-func', funcionarioNome: 'Funcion�rio Demo', status: 'pendente', fotos: [], observacao: '', dataExecucao: dataHoje, horaExecucao: '' },
    ]));
  }

  // Materiais / Estoque
  if (!localStorage.getItem('manutencao-materiais')) {
    localStorage.setItem('manutencao-materiais', JSON.stringify([
      { id: 'm1', protocolo: 'MAT-20260301-1001', nome: 'Detergente Multiuso', categoria: 'Limpeza', unidade: 'Litros', qtd: 25, min: 10, custo: 18.9, emailNotificacao: 'estoque@condominio.com', condominio: 'Residencial Aurora' },
      { id: 'm2', protocolo: 'MAT-20260301-1002', nome: 'Saco de Lixo 100L', categoria: 'Descart�veis', unidade: 'Pacotes', qtd: 8, min: 5, custo: 12.5, emailNotificacao: 'estoque@condominio.com', condominio: 'Residencial Aurora' },
      { id: 'm3', protocolo: 'MAT-20260301-1003', nome: 'Desinfetante 5L', categoria: 'Limpeza', unidade: 'un', qtd: 15, min: 8, custo: 22.5, emailNotificacao: 'estoque@condominio.com', condominio: 'Residencial Aurora' },
      { id: 'm4', protocolo: 'MAT-20260301-1004', nome: 'Papel Higi�nico', categoria: 'Higiene', unidade: 'Fardos', qtd: 3, min: 5, custo: 45, emailNotificacao: 'estoque@condominio.com', condominio: 'Residencial Aurora' },
      { id: 'm5', protocolo: 'MAT-20260301-1005', nome: 'L�mpada LED 12W', categoria: 'El�trica', unidade: 'Unidades', qtd: 20, min: 10, custo: 8.9, emailNotificacao: 'estoque@condominio.com', condominio: 'Residencial Aurora' },
    ]));
  }

  // Movimenta��es de materiais (key: manutencao-materiais-movimentacoes)
  if (!localStorage.getItem('manutencao-materiais-movimentacoes')) {
    localStorage.setItem('manutencao-materiais-movimentacoes', JSON.stringify([
      { id: 'mv1', materialId: 'm1', tipo: 'entrada', quantidade: 30, observacao: 'Compra mensal', audioUrl: null, fotos: [], notaFiscalUrl: null, data: new Date(now - 10 * day).toISOString().slice(0, 10), funcionario: 'Admin Demo' },
      { id: 'mv2', materialId: 'm1', tipo: 'saida', quantidade: 5, observacao: 'Uso na limpeza do hall', audioUrl: null, fotos: [], notaFiscalUrl: null, data: new Date(now - 3 * day).toISOString().slice(0, 10), funcionario: 'Funcion�rio Demo' },
      { id: 'mv3', materialId: 'm4', tipo: 'saida', quantidade: 2, observacao: 'Reposi��o banheiros', audioUrl: null, fotos: [], notaFiscalUrl: null, data: new Date(now - 2 * day).toISOString().slice(0, 10), funcionario: 'Funcion�rio Demo' },
    ]));
  }

  // Escalas
  if (!localStorage.getItem('manutencao-escalas')) {
    localStorage.setItem('manutencao-escalas', JSON.stringify([
      { id: 'e1', func: 'Funcion�rio Demo', dia: 1, inicio: '07:00', fim: '16:00', local: 'Residencial Aurora - Hall e �reas Comuns', funcao: 'Limpeza', observacoes: '' },
      { id: 'e2', func: 'Funcion�rio Demo', dia: 2, inicio: '07:00', fim: '16:00', local: 'Residencial Aurora - Garagem e Piscina', funcao: 'Limpeza', observacoes: '' },
      { id: 'e3', func: 'Funcion�rio Demo', dia: 3, inicio: '07:00', fim: '16:00', local: 'Residencial Aurora - Blocos A e B', funcao: 'Limpeza', observacoes: '' },
      { id: 'e4', func: 'Funcion�rio Demo', dia: 4, inicio: '07:00', fim: '16:00', local: 'Edif�cio Central Park', funcao: 'Limpeza', observacoes: '' },
      { id: 'e5', func: 'Funcion�rio Demo', dia: 5, inicio: '07:00', fim: '12:00', local: 'Condom�nio Vila Verde', funcao: 'Limpeza', observacoes: '' },
    ]));
  }

  // Vencimentos
  if (!localStorage.getItem('manutencao-vencimentos')) {
    localStorage.setItem('manutencao-vencimentos', JSON.stringify([
      { id: 'v1', titulo: 'Contrato Elevadores', tipo: 'contrato', descricao: 'Manuten��o preventiva mensal dos elevadores', condominio: 'Residencial Aurora', dataVencimento: new Date(now + 30 * day).toISOString().slice(0, 10), emails: ['sindico@aurora.com'], avisos: [{ id: 'av1', tipo: 'dias_antes', valor: 30 }, { id: 'av2', tipo: 'dias_antes', valor: 7 }], qtdNotificacoes: 0, criadoEm: new Date(now - 60 * day).toISOString() },
      { id: 'v2', titulo: 'Seguro Predial', tipo: 'contrato', descricao: 'Renova��o anual do seguro predial', condominio: 'Residencial Aurora', dataVencimento: new Date(now + 15 * day).toISOString().slice(0, 10), emails: ['sindico@aurora.com'], avisos: [{ id: 'av3', tipo: 'dias_antes', valor: 15 }], qtdNotificacoes: 0, criadoEm: new Date(now - 90 * day).toISOString() },
      { id: 'v3', titulo: 'Dedetiza��o Trimestral', tipo: 'servico', descricao: 'Servi�o trimestral de dedetiza��o', condominio: 'Residencial Aurora', dataVencimento: new Date(now + 5 * day).toISOString().slice(0, 10), emails: ['sindico@aurora.com'], avisos: [{ id: 'av4', tipo: 'dias_antes', valor: 7 }, { id: 'av5', tipo: 'dias_antes', valor: 3 }], qtdNotificacoes: 0, criadoEm: new Date(now - 80 * day).toISOString() },
    ]));
  }

  // Moradores
  if (!localStorage.getItem('manutencao-moradores')) {
    localStorage.setItem('manutencao-moradores', JSON.stringify([
      { id: 'mor1', nome: 'Maria Silva', condominio: 'Residencial Aurora', bloco: 'A', apartamento: '101', whatsapp: '(11) 99888-0001', email: 'maria@email.com', perfil: 'Propriet�rio', criadoEm: new Date(now - 60 * day).toISOString() },
      { id: 'mor2', nome: 'Pedro Santos', condominio: 'Residencial Aurora', bloco: 'A', apartamento: '202', whatsapp: '(11) 99888-0002', email: 'pedro@email.com', perfil: 'Inquilino', criadoEm: new Date(now - 45 * day).toISOString() },
      { id: 'mor3', nome: 'Ana Costa', condominio: 'Residencial Aurora', bloco: 'B', apartamento: '303', whatsapp: '(11) 99888-0003', email: 'ana@email.com', perfil: 'Propriet�rio', criadoEm: new Date(now - 30 * day).toISOString() },
      { id: 'mor4', nome: 'Carlos Mendes', condominio: 'Residencial Aurora', bloco: 'B', apartamento: '501', whatsapp: '(11) 99888-0004', email: 'carlos@email.com', perfil: 'Propriet�rio', criadoEm: new Date(now - 20 * day).toISOString() },
      { id: 'mor5', nome: 'Juliana Ferreira', condominio: 'Residencial Aurora', bloco: 'C', apartamento: '102', whatsapp: '(11) 99888-0005', email: 'juliana@email.com', perfil: 'Inquilino', criadoEm: new Date(now - 10 * day).toISOString() },
    ]));
  }

  // Comunicados
  if (!localStorage.getItem('manutencao-comunicados')) {
    localStorage.setItem('manutencao-comunicados', JSON.stringify([
      { id: 'com1', tipo: 'comunicado', titulo: 'Manuten��o da Piscina', mensagem: 'Informamos que a piscina ficar� fechada para manuten��o nos dias 10 e 11 de mar�o.', destinatarioTipo: 'condominio', condominio: 'Residencial Aurora', emailsEnviados: ['maria@email.com', 'pedro@email.com', 'ana@email.com'], tracking: [{ email: 'maria@email.com', nome: 'Maria Silva', status: 'enviado', atualizadoEm: new Date(now - 2 * day).toISOString() }, { email: 'pedro@email.com', nome: 'Pedro Santos', status: 'aberto', atualizadoEm: new Date(now - day).toISOString() }], criadoEm: new Date(now - 2 * day).toISOString(), enviadoPor: 'Admin Demo' },
      { id: 'com2', tipo: 'aviso', titulo: 'Assembleia Ordin�ria', mensagem: 'Convocamos todos os cond�minos para a assembleia ordin�ria no dia 15/03 �s 19h no sal�o de festas.', destinatarioTipo: 'condominio', condominio: 'Residencial Aurora', emailsEnviados: ['maria@email.com', 'pedro@email.com', 'ana@email.com', 'carlos@email.com', 'juliana@email.com'], tracking: [{ email: 'maria@email.com', nome: 'Maria Silva', status: 'aberto', atualizadoEm: new Date(now - 4 * day).toISOString() }], criadoEm: new Date(now - 5 * day).toISOString(), enviadoPor: 'Admin Demo' },
    ]));
  }

  // Quadro de Atividades (Kanban)
  if (!localStorage.getItem('manutencao-quadro-atividades')) {
    localStorage.setItem('manutencao-quadro-atividades', JSON.stringify([
      { id: 'qa1', titulo: 'Limpar escadas Bloco A', descricao: 'Limpeza completa das escadas do 1� ao 10� andar', status: 'a_fazer', prioridade: 'media', rotina: 'semanal', responsavel: 'Funcion�rio Demo', condominio: 'Residencial Aurora', criadoPor: 'Admin Demo', criadoEm: new Date(now - 2 * day).toISOString(), historico: [] },
      { id: 'qa2', titulo: 'Podar jardim frontal', descricao: 'Poda das �rvores e arbustos da entrada', status: 'em_andamento', prioridade: 'baixa', rotina: 'mensal', responsavel: 'Funcion�rio Demo', condominio: 'Residencial Aurora', criadoPor: 'Admin Demo', criadoEm: new Date(now - 3 * day).toISOString(), historico: [] },
      { id: 'qa3', titulo: 'Trocar filtro da piscina', descricao: 'Substituir filtro de areia da piscina', status: 'em_revisao', prioridade: 'alta', rotina: 'anual', responsavel: 'Supervisor Demo', condominio: 'Residencial Aurora', criadoPor: 'Admin Demo', criadoEm: new Date(now - 5 * day).toISOString(), historico: [] },
      { id: 'qa4', titulo: 'Instalar c�meras Bloco C', descricao: 'Instala��o de 4 c�meras de seguran�a', status: 'concluido', prioridade: 'alta', rotina: 'data_especifica', dataEspecifica: new Date(now - 2 * day).toISOString().slice(0, 10), responsavel: 'Supervisor Demo', condominio: 'Residencial Aurora', criadoPor: 'Admin Demo', criadoEm: new Date(now - 7 * day).toISOString(), historico: [] },
    ]));
  }

  // Vistorias
  if (!localStorage.getItem('manutencao-vistorias')) {
    localStorage.setItem('manutencao-vistorias', JSON.stringify([
      { id: 'VST-001', titulo: 'Vistoria Mensal - Bloco A', condominio: 'Residencial Aurora', tipo: 'rotina', data: dataHoje, responsavel: 'Supervisor Demo', status: 'em_andamento', criadoEm: now - 5 * day, itens: [
        { id: 'v1-1', local: 'Hall de Entrada', descricao: 'Verificar estado do piso e paredes', fotos: [], status: 'conforme', prioridade: 'media', observacao: 'Piso em bom estado' },
        { id: 'v1-2', local: 'Escadas', descricao: 'Verificar ilumina��o e corrim�os', fotos: [], status: 'conforme', prioridade: 'media', observacao: '' },
        { id: 'v1-3', local: '5� Andar', descricao: 'Limpeza geral do corredor', fotos: [], status: 'nao_conforme', prioridade: 'alta', observacao: 'Necessita limpeza mais profunda' },
      ]},
      { id: 'VST-002', titulo: 'Inspe��o Garagem', condominio: 'Residencial Aurora', tipo: 'preventiva', data: new Date(now + 2 * day).toISOString().slice(0, 10), responsavel: 'Supervisor Demo', status: 'pendente', criadoEm: now - day, itens: [
        { id: 'v2-1', local: 'Garagem B1', descricao: 'Verificar sinaliza��o', fotos: [], status: 'pendente', prioridade: 'media', observacao: '' },
        { id: 'v2-2', local: 'Garagem B1', descricao: 'Verificar ilumina��o', fotos: [], status: 'pendente', prioridade: 'media', observacao: '' },
        { id: 'v2-3', local: 'Garagem B1', descricao: 'Testar port�o autom�tico', fotos: [], status: 'pendente', prioridade: 'alta', observacao: '' },
      ]},
    ]));
  }

  // Roteiros de Execu��o (key: manutencao_roteiros_execucao)
  if (!localStorage.getItem('manutencao_roteiros_execucao')) {
    localStorage.setItem('manutencao_roteiros_execucao', JSON.stringify([
      { id: 'rot1', titulo: 'Limpeza Completa do Hall', descricao: 'Passo a passo para limpeza do hall de entrada', categoria: 'Limpeza', capa: '', passos: [
        { id: 'p1', titulo: 'Varrer o piso', descricao: 'Remover toda sujeira com vassoura', imagens: [], videoUrl: '' },
        { id: 'p2', titulo: 'Passar pano �mido', descricao: 'Usar detergente dilu�do no pano', imagens: [], videoUrl: '' },
        { id: 'p3', titulo: 'Limpar vidros', descricao: 'Usar limpa-vidros nas portas e espelhos', imagens: [], videoUrl: '' },
        { id: 'p4', titulo: 'Organizar m�veis', descricao: 'Alinhar sof�s e cadeiras', imagens: [], videoUrl: '' },
      ], criadoPor: 'Supervisor Demo', criadoEm: agora, atualizadoEm: agora },
      { id: 'rot2', titulo: 'Manuten��o Preventiva da Piscina', descricao: 'Verifica��o e tratamento semanal da piscina', categoria: 'Piscina', capa: '', passos: [
        { id: 'p5', titulo: 'Verificar n�vel de cloro', descricao: 'Usar kit de teste para medir n�vel de cloro e pH', imagens: [], videoUrl: '' },
        { id: 'p6', titulo: 'Limpar bordas', descricao: 'Escovar bordas e azulejos com produto adequado', imagens: [], videoUrl: '' },
        { id: 'p7', titulo: 'Aspirar fundo', descricao: 'Passar aspirador no fundo da piscina removendo detritos', imagens: [], videoUrl: '' },
      ], criadoPor: 'Supervisor Demo', criadoEm: new Date(now - 5 * day).toISOString(), atualizadoEm: new Date(now - 5 * day).toISOString() },
      { id: 'rot3', titulo: 'Limpeza da Garagem', descricao: 'Procedimento completo de limpeza da garagem', categoria: 'Limpeza', capa: '', passos: [
        { id: 'p8', titulo: 'Sinalizar �rea', descricao: 'Colocar cones e placas de sPiso Molhados', imagens: [], videoUrl: '' },
        { id: 'p9', titulo: 'Varrer toda a �rea', descricao: 'Recolher sujeira grossa com vassoura', imagens: [], videoUrl: '' },
        { id: 'p10', titulo: 'Lavar com m�quina', descricao: 'Usar m�quina de press�o para lavar o piso', imagens: [], videoUrl: '' },
        { id: 'p11', titulo: 'Secar e retirar sinaliza��o', descricao: 'Aguardar secar e retirar cones', imagens: [], videoUrl: '' },
      ], criadoPor: 'Admin Demo', criadoEm: new Date(now - 10 * day).toISOString(), atualizadoEm: new Date(now - 10 * day).toISOString() },
    ]));
  }

  // Roteiros Exec Log
  if (!localStorage.getItem('manutencao_roteiros_exec_log')) {
    localStorage.setItem('manutencao_roteiros_exec_log', JSON.stringify([
      { roteiroId: 'rot1', funcionario: 'Funcion�rio Demo', data: new Date(now - day).toISOString(), passosExec: [
        { passoId: 'p1', feito: true, fotoAntes: '', fotoDepois: '', descAntes: '', descDepois: 'Piso varrido completamente', imagens: [], problema: '', problemaEnviado: false, status: 'concluido', prioridade: 'media' },
        { passoId: 'p2', feito: true, fotoAntes: '', fotoDepois: '', descAntes: '', descDepois: 'Pano �mido aplicado com detergente', imagens: [], problema: '', problemaEnviado: false, status: 'concluido', prioridade: 'media' },
        { passoId: 'p3', feito: true, fotoAntes: '', fotoDepois: '', descAntes: '', descDepois: 'Vidros limpos e brilhando', imagens: [], problema: '', problemaEnviado: false, status: 'concluido', prioridade: 'media' },
        { passoId: 'p4', feito: false, fotoAntes: '', fotoDepois: '', descAntes: '', descDepois: '', imagens: [], problema: 'Sof� com mancha que precisa de limpeza profissional', problemaEnviado: true, status: 'problema', prioridade: 'alta' },
      ]},
    ]));
  }

  // Reportes
  if (!localStorage.getItem('manutencao-reportes')) {
    localStorage.setItem('manutencao-reportes', JSON.stringify([
      { protocolo: 'REP-001', itemDesc: 'L�mpada queimada corredor 3� andar', checklistId: 'CK-001', descricao: 'L�mpada do corredor do 3� andar Bloco A queimada', status: 'aberto', prioridade: 'baixa', imagens: [], data: new Date(now - 2 * day).toISOString() },
      { protocolo: 'REP-002', itemDesc: 'Infiltra��o no teto do sal�o', checklistId: '', descricao: 'Mancha de infiltra��o no teto do sal�o de festas', status: 'em_analise', prioridade: 'alta', imagens: [], data: new Date(now - 4 * day).toISOString() },
    ]));
  }

  // WhatsApp Contacts (shared across pages)
  if (!localStorage.getItem('manutencao-whats-contatos')) {
    localStorage.setItem('manutencao-whats-contatos', JSON.stringify([
      { id: 'wh1', nome: 'Supervisor Demo', telefone: '(11) 99999-1001' },
      { id: 'wh2', nome: 'Admin Demo', telefone: '(11) 99999-1002' },
    ]));
  }

  // Inspe��es
  if (!localStorage.getItem('manutencao-inspecoes')) {
    localStorage.setItem('manutencao-inspecoes', JSON.stringify([
      { id: 'insp1', condominioId: 'c1', tipo: 'areas_comuns', local: 'Hall e Corredores - Bloco A', inspetorId: 'demo-sup', data: now - 3 * day, status: 'conforme', observacoes: '�reas em bom estado geral', fotos: [], itensVerificados: [
        { item: 'Piso limpo e seco', conforme: true },
        { item: 'Ilumina��o funcionando', conforme: true },
        { item: 'Lixeiras esvaziadas', conforme: true },
        { item: 'Vidros limpos', conforme: false, obs: 'Manchas no vidro da porta principal' },
      ], criadoEm: now - 3 * day },
      { id: 'insp2', condominioId: 'c1', tipo: 'elevadores', local: 'Elevadores Bloco A e B', inspetorId: 'demo-sup', data: now - day, status: 'nao_conforme', observacoes: 'Elevador B com ru�do no motor', fotos: [], itensVerificados: [
        { item: 'Cabine limpa', conforme: true },
        { item: 'Bot�es funcionando', conforme: true },
        { item: 'Sem ru�dos anormais', conforme: false, obs: 'Ru�do no motor do elevador B' },
        { item: 'Espelhos intactos', conforme: true },
      ], criadoEm: now - day },
    ]));
  }

  // QR Code Formul�rios
  if (!localStorage.getItem('manutencao-qrcodes')) {
    localStorage.setItem('manutencao-qrcodes', JSON.stringify([
      { id: 'qr1', nome: 'Avalia��o de Limpeza', descricao: 'Formul�rio para moradores avaliarem a limpeza das �reas comuns', logo: null, blocos: [
        { id: 'b1', tipo: 'titulo', label: 'Avalia��o de Limpeza', obrigatorio: false },
        { id: 'b2', tipo: 'avaliacao_estrela', label: 'Como voc� avalia a limpeza?', obrigatorio: true, maxEstrelas: 5 },
        { id: 'b3', tipo: 'checklist', label: '�reas verificadas', obrigatorio: false, opcoes: ['Hall', 'Escadas', 'Elevador', 'Garagem', 'Piscina'] },
        { id: 'b4', tipo: 'texto', label: 'Observa��es adicionais', obrigatorio: false },
      ], dispensarIdentificacao: false, blocosCadastrados: [], criadoPor: 'demo-admin', criadoEm: now - 10 * day, respostas: 5, ativo: true },
      { id: 'qr2', nome: 'Reporte de Ocorr�ncia', descricao: 'Formul�rio para reportar problemas nas �reas comuns', logo: null, blocos: [
        { id: 'b5', tipo: 'titulo', label: 'Reporte de Ocorr�ncia', obrigatorio: false },
        { id: 'b6', tipo: 'descricao', label: 'Descreva o problema encontrado', obrigatorio: true },
        { id: 'b7', tipo: 'galeria', label: 'Fotos do problema', obrigatorio: false, maxFotos: 3 },
        { id: 'b8', tipo: 'prioridade', label: 'N�vel de urg�ncia', obrigatorio: true },
      ], dispensarIdentificacao: false, blocosCadastrados: [], criadoPor: 'demo-admin', criadoEm: now - 5 * day, respostas: 2, ativo: true },
    ]));
  }

  // Equipamentos
  if (!localStorage.getItem('manutencao-equipamentos')) {
    localStorage.setItem('manutencao-equipamentos', JSON.stringify([
      { id: 'eq1', codigo: 'EQ-001', nome: 'Elevador Social - Bloco A', descricao: 'Elevador social, capacidade 8 pessoas', categoria: 'elevador', marca: 'Otis', modelo: 'Gen2', localizacao: 'Bloco A', andar: 'Térreo', dataInstalacao: '2022-05-10', status: 'ativo', fornecedorId: 'forn1', condominio: 'Residencial Aurora' },
      { id: 'eq2', codigo: 'EQ-002', nome: 'Bomba de Recalque', descricao: 'Bomba centrífuga para abastecimento de água', categoria: 'bomba', marca: 'Schneider', modelo: 'BC-21 R', localizacao: 'Casa de Máquinas', andar: 'Subsolo', dataInstalacao: '2024-01-15', status: 'ativo', fornecedorId: 'forn2', condominio: 'Residencial Aurora' },
      { id: 'eq3', codigo: 'EQ-003', nome: 'Gerador Diesel', descricao: 'Gerador de emergência automático 150kVA', categoria: 'gerador', marca: 'Cummins', modelo: 'C150D5', localizacao: 'Casa de Máquinas', andar: 'Subsolo', dataInstalacao: '2023-06-20', status: 'ativo', condominio: 'Residencial Aurora' },
      { id: 'eq4', codigo: 'EQ-004', nome: 'Central Alarme Incêndio', descricao: 'Painel central com 32 zonas', categoria: 'incendio', marca: 'Intelbras', modelo: 'CIC-32', localizacao: 'Portaria', andar: 'Térreo', dataInstalacao: '2023-01-10', status: 'ativo', condominio: 'Residencial Aurora' },
      { id: 'eq5', codigo: 'EQ-005', nome: 'Portão Automático Garagem', descricao: 'Portão deslizante com motor industrial', categoria: 'portao', marca: 'PPA', modelo: 'DZ Rio 800', localizacao: 'Entrada Garagem', dataInstalacao: '2024-03-01', status: 'ativo', condominio: 'Residencial Aurora' },
    ]));
  }

  // Fornecedores
  if (!localStorage.getItem('manutencao-fornecedores')) {
    localStorage.setItem('manutencao-fornecedores', JSON.stringify([
      { id: 'forn1', nome: 'Alpha Elevadores', tipo: 'prestador', especialidade: 'Manutenção de elevadores', telefone: '(11) 4000-3000', email: 'contato@alphaelevadores.com', cidade: 'São Paulo', estado: 'SP', contatoNome: 'Ricardo Silva', status: 'ativo', valorContrato: 1850, condominio: 'Residencial Aurora' },
      { id: 'forn2', nome: 'HidroTec Bombas', tipo: 'assistencia_tecnica', especialidade: 'Bombas e sistemas hidráulicos', telefone: '(11) 4000-4000', email: 'suporte@hidrotec.com.br', cidade: 'São Paulo', estado: 'SP', contatoNome: 'Fernanda Oliveira', status: 'ativo', valorContrato: 980, condominio: 'Residencial Aurora' },
      { id: 'forn3', nome: 'EletroSafe Instalações', tipo: 'prestador', especialidade: 'Instalações elétricas e SPDA', telefone: '(11) 4000-5000', email: 'orcamento@eletrosafe.com.br', cidade: 'São Paulo', estado: 'SP', contatoNome: 'Jorge Pereira', status: 'ativo', condominio: 'Residencial Aurora' },
    ]));
  }

  // Planos de Manutenção
  if (!localStorage.getItem('manutencao-planos-manutencao')) {
    localStorage.setItem('manutencao-planos-manutencao', JSON.stringify([
      { id: 'plano1', titulo: 'Plano Elevador Mensal', descricao: 'Manutenção preventiva mensal do elevador', equipamentoId: 'eq1', categoriaEquipamento: 'elevador', frequencia: 'mensal', diaExecucao: 5, itensVerificacao: [{ item: 'Checar cabos de aço', obrigatorio: true }, { item: 'Testar freio de emergência', obrigatorio: true }, { item: 'Lubrificar guias', obrigatorio: true }], responsavelId: 'demo-sup', fornecedorId: 'forn1', custoEstimado: 650, proximaExecucao: new Date(now + 10 * day).toISOString().slice(0, 10), autoGerarOs: true, status: 'ativo', condominio: 'Residencial Aurora' },
      { id: 'plano2', titulo: 'Revisão Trimestral da Bomba', descricao: 'Inspeção do sistema de recalque', equipamentoId: 'eq2', categoriaEquipamento: 'bomba', frequencia: 'trimestral', diaExecucao: 10, itensVerificacao: [{ item: 'Verificar pressão', obrigatorio: true }, { item: 'Checar selo mecânico', obrigatorio: true }], responsavelId: 'demo-sup', fornecedorId: 'forn2', custoEstimado: 980, proximaExecucao: new Date(now + 60 * day).toISOString().slice(0, 10), autoGerarOs: true, status: 'ativo', condominio: 'Residencial Aurora' },
    ]));
  }

  // Documentos Técnicos
  if (!localStorage.getItem('manutencao-documentos')) {
    localStorage.setItem('manutencao-documentos', JSON.stringify([
      { id: 'doc1', titulo: 'Manual do Elevador Otis Gen2', descricao: 'Manual técnico completo.', tipo: 'manual', status: 'vigente', equipamentoId: 'eq1', fornecedorId: 'forn1', dataEmissao: '2025-01-10', dataValidade: '2027-01-10', tags: ['manual', 'elevador'], versao: '1.0', condominio: 'Residencial Aurora' },
      { id: 'doc2', titulo: 'AVCB - Auto de Vistoria do Corpo de Bombeiros', descricao: 'Certificado de conformidade contra incêndio.', tipo: 'certificado', status: 'vigente', dataEmissao: '2025-06-15', dataValidade: '2026-06-15', tags: ['avcb', 'incêndio'], versao: '1.0', condominio: 'Residencial Aurora' },
      { id: 'doc3', titulo: 'Laudo de Instalações Elétricas', descricao: 'Laudo técnico conforme NBR 5410.', tipo: 'laudo', status: 'vigente', fornecedorId: 'forn3', dataEmissao: '2025-09-01', dataValidade: '2026-09-01', tags: ['laudo', 'elétrica'], versao: '2.0', condominio: 'Residencial Aurora' },
    ]));
  }

  // Solicitações de Moradores
  if (!localStorage.getItem('manutencao-solicitacoes')) {
    localStorage.setItem('manutencao-solicitacoes', JSON.stringify([
      { id: 'sol1', protocolo: 'SOL-001', moradorId: 'mor1', tipo: 'manutencao', titulo: 'Vazamento no hall', descricao: 'Vazamento no teto do hall próximo ao elevador.', local: 'Hall do Bloco A', status: 'em_analise', criadoEm: new Date(now - 3 * day).toISOString(), condominio: 'Residencial Aurora' },
      { id: 'sol2', protocolo: 'SOL-002', moradorId: 'mor2', tipo: 'reclamacao', titulo: 'Barulho no salão de festas', descricao: 'Festa até 3h da manhã no último sábado.', local: 'Salão de Festas', status: 'aberta', criadoEm: new Date(now - day).toISOString(), condominio: 'Residencial Aurora' },
      { id: 'sol3', protocolo: 'SOL-003', moradorId: 'mor3', tipo: 'sugestao', titulo: 'Instalar bicicletário', descricao: 'Sugiro bicicletário coberto na garagem.', local: 'Garagem', status: 'respondida', criadoEm: new Date(now - 5 * day).toISOString(), condominio: 'Residencial Aurora' },
    ]));
  }

  // SLA Configurações
  if (!localStorage.getItem('manutencao-sla-configs')) {
    localStorage.setItem('manutencao-sla-configs', JSON.stringify([
      { id: 'sla1', prioridade: 'urgente', tempoRespostaHoras: 2, tempoResolucaoHoras: 12 },
      { id: 'sla2', prioridade: 'alta', tempoRespostaHoras: 4, tempoResolucaoHoras: 24 },
      { id: 'sla3', prioridade: 'media', tempoRespostaHoras: 8, tempoResolucaoHoras: 48 },
      { id: 'sla4', prioridade: 'baixa', tempoRespostaHoras: 24, tempoResolucaoHoras: 120 },
    ]));
  }

  // Orçamentos
  if (!localStorage.getItem('manutencao-orcamentos')) {
    localStorage.setItem('manutencao-orcamentos', JSON.stringify([
      { id: 'orc1', titulo: 'Orçamento de pintura do hall', clienteNome: 'Residencial Aurora', descricaoGeral: 'Pintura completa do hall de entrada.', condicoesPagamento: '30% entrada / 70% entrega', validadeDias: 15, prazoExecucao: '7 dias úteis', status: 'enviado', valorTotal: 3500, valorFinal: 3500, itens: [{ descricao: 'Pintura acrílica premium', tipo: 'servico', quantidade: 1, valorUnitario: 2800, valorTotal: 2800 }, { descricao: 'Tinta Suvinil 18L', tipo: 'material', quantidade: 2, valorUnitario: 350, valorTotal: 700 }], criadoEm: new Date(now - 5 * day).toISOString(), condominio: 'Residencial Aurora' },
      { id: 'orc2', titulo: 'Troca do portão automático', clienteNome: 'Residencial Aurora', descricaoGeral: 'Fornecimento e instalação de portão deslizante.', condicoesPagamento: 'À vista', validadeDias: 10, prazoExecucao: '15 dias úteis', status: 'rascunho', valorTotal: 8500, valorFinal: 8075, desconto: 5, itens: [{ descricao: 'Portão deslizante 5m', tipo: 'material', quantidade: 1, valorUnitario: 4500, valorTotal: 4500 }, { descricao: 'Motor PPA DZ Rio 800', tipo: 'material', quantidade: 1, valorUnitario: 1800, valorTotal: 1800 }, { descricao: 'Mão de obra', tipo: 'servico', quantidade: 1, valorUnitario: 2200, valorTotal: 2200 }], criadoEm: new Date(now - 2 * day).toISOString(), condominio: 'Residencial Aurora' },
    ]));
  }

  // Geolocalização
  if (!localStorage.getItem('manutencao-geolocalizacao')) {
    localStorage.setItem('manutencao-geolocalizacao', JSON.stringify([
      { id: 'geo1', userId: 'demo-func', latitude: -23.5505, longitude: -46.6333, endereco: 'Rua das Flores, 500', horaChegada: new Date(now - day).toISOString(), tempoTotal: 540, data: new Date(now - day).toISOString().slice(0, 10), funcaoId: 'limpeza' },
      { id: 'geo2', userId: 'demo-func', latitude: -23.551, longitude: -46.634, endereco: 'Av Paulista, 1500', horaChegada: new Date(now - 2 * day).toISOString(), tempoTotal: 480, data: new Date(now - 2 * day).toISOString().slice(0, 10), funcaoId: 'manutencao' },
    ]));
  }

  // Notificações
  if (!localStorage.getItem('manutencao-notificacoes')) {
    localStorage.setItem('manutencao-notificacoes', JSON.stringify([
      { id: 'notif1', titulo: 'Nova OS urgente', mensagem: 'Vazamento no Bloco A - prioridade alta.', tipo: 'warning', link: '/ordens-servico', lida: false, criadoEm: new Date(now - day).toISOString() },
      { id: 'notif2', titulo: 'Vencimento próximo: Seguro Predial', mensagem: 'O seguro vence em 15 dias.', tipo: 'info', link: '/vencimentos', lida: false, criadoEm: new Date(now - 2 * day).toISOString() },
      { id: 'notif3', titulo: 'Checklist concluído', mensagem: 'Salão de Festas - checklist finalizado.', tipo: 'success', link: '/checklists', lida: true, criadoEm: new Date(now - 3 * day).toISOString() },
    ]));
  }

  // Controle de Ponto
  if (!localStorage.getItem('manutencao-controle-ponto')) {
    const ontem7h = new Date(now - day); ontem7h.setHours(7, 2, 0, 0);
    const ontem16h = new Date(now - day); ontem16h.setHours(16, 0, 0, 0);
    const ante7h = new Date(now - 2 * day); ante7h.setHours(7, 10, 0, 0);
    const ante16h = new Date(now - 2 * day); ante16h.setHours(15, 55, 0, 0);
    localStorage.setItem('manutencao-controle-ponto', JSON.stringify([
      { funcionario: { nome: 'Funcion�rio Demo', email: 'demo-func@manutencao.com', cargo: 'Auxiliar de Limpeza', perfil: 'funcionario' }, tipo: 'entrada', dataHora: ontem7h.toISOString(), geolocalizacao: { latitude: -23.5505, longitude: -46.6333 }, endereco: 'Rua das Flores, 500 - S�o Paulo' },
      { funcionario: { nome: 'Funcion�rio Demo', email: 'demo-func@manutencao.com', cargo: 'Auxiliar de Limpeza', perfil: 'funcionario' }, tipo: 'saida', dataHora: ontem16h.toISOString(), geolocalizacao: { latitude: -23.5505, longitude: -46.6333 }, endereco: 'Rua das Flores, 500 - S�o Paulo', permanencia: '08h58min' },
      { funcionario: { nome: 'Funcion�rio Demo', email: 'demo-func@manutencao.com', cargo: 'Auxiliar de Limpeza', perfil: 'funcionario' }, tipo: 'entrada', dataHora: ante7h.toISOString(), geolocalizacao: { latitude: -23.5505, longitude: -46.6333 }, endereco: 'Rua das Flores, 500 - S�o Paulo' },
      { funcionario: { nome: 'Funcion�rio Demo', email: 'demo-func@manutencao.com', cargo: 'Auxiliar de Limpeza', perfil: 'funcionario' }, tipo: 'saida', dataHora: ante16h.toISOString(), geolocalizacao: { latitude: -23.5505, longitude: -46.6333 }, endereco: 'Rua das Flores, 500 - S�o Paulo', permanencia: '08h45min' },
    ]));
  }

  demoKeys.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;

    try {
      setNormalizedDemoItem(key, JSON.parse(raw));
    } catch {
      localStorage.removeItem(key);
    }
  });
}

// Demo user profiles
export const DEMO_USERS: Record<string, { id: string; email: string; nome: string; role: UserRole; condominioId: string }> = {
  administrador: { id: 'demo-admin', email: 'demo-admin@manutencao.com', nome: 'Admin Demo', role: 'administrador', condominioId: 'c1' },
  supervisor: { id: 'demo-sup', email: 'demo-sup@manutencao.com', nome: 'Supervisor Demo', role: 'supervisor', condominioId: 'c1' },
  funcionario: { id: 'demo-func', email: 'demo-func@manutencao.com', nome: 'Funcion�rio Demo', role: 'funcionario', condominioId: 'c1' },
};
