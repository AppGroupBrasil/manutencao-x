// ===== Perfis e Hierarquia =====
export type UserRole = 'master' | 'administrador' | 'supervisor' | 'funcionario';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  master: 4,
  administrador: 3,
  supervisor: 2,
  funcionario: 1,
};

export interface User {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  ativo: boolean;
  bloqueado: boolean;
  motivoBloqueio?: string;
  criadoPor: string;
  administradorId?: string;
  supervisorId?: string;
  condominioId?: string;
  avatarUrl?: string;
  telefone?: string;
  cargo?: string;
  criadoEm: number;
  atualizadoEm: number;
}

// ===== Funções do Sistema =====
export interface FuncaoSistema {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  rota: string;
  ativa: boolean;
  habilitadaPara: UserRole[];
  permissoesCustomizadas: Record<string, boolean>;
}

// ===== Permissões =====
export interface PermissaoUsuario {
  userId: string;
  funcaoId: string;
  podeVer: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeCriar: boolean;
}

// ===== Geolocalização =====
export interface RegistroLocalizacao {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  endereco: string;
  horaChegada: number;
  horaSaida?: number;
  tempoTotal?: number; // em minutos
  data: string;
  funcaoId?: string;
}

export interface PosicaoAtual {
  userId: string;
  latitude: number;
  longitude: number;
  endereco: string;
  ultimaAtualizacao: number;
}

// ===== Tema =====
export interface TemaConfig {
  corPrimaria: string;
  corSecundaria: string;
  corMenu: string;
  corBotao: string;
  corFundo: string;
  modoEscuro: boolean;
  logoUrl?: string;
  loginTitulo?: string;
  loginSubtitulo?: string;
}

export const CORES_DISPONIVEIS = [
  { nome: 'Azul Royal', valor: '#1a73e8' },
  { nome: 'Verde Esmeralda', valor: '#00897b' },
  { nome: 'Roxo', valor: '#7b1fa2' },
  { nome: 'Vermelho', valor: '#d32f2f' },
  { nome: 'Laranja', valor: '#f57c00' },
  { nome: 'Índigo', valor: '#303f9f' },
  { nome: 'Teal', valor: '#00796b' },
  { nome: 'Rosa', valor: '#c2185b' },
  { nome: 'Marrom', valor: '#5d4037' },
  { nome: 'Cinza Azulado', valor: '#455a64' },
];

// ===== Relatórios =====
export interface DadosRelatorio {
  titulo: string;
  tipo: 'bar' | 'line' | 'pie' | 'area';
  dados: Array<Record<string, string | number>>;
  chaveX: string;
  chavesY: string[];
  cores?: string[];
}

// ===== Controle de Presença =====
export interface RegistroPresenca {
  id: string;
  userId: string;
  data: string;
  horaEntrada: number;
  horaSaida?: number;
  localizacaoEntrada: { lat: number; lng: number; endereco: string };
  localizacaoSaida?: { lat: number; lng: number; endereco: string };
  totalHoras?: number;
}

// ===== Condomínio =====
export interface Condominio {
  id: string;
  nome: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  sindico: string;
  telefone: string;
  email: string;
  blocos: number;
  unidades: number;
  criadoPor: string;
  criadoEm: number;
  ativo: boolean;
}

// ===== Ordem de Serviço =====
export type StatusOS = 'aberta' | 'em_andamento' | 'concluida' | 'cancelada' | 'aguardando';

export interface OrdemServico {
  id: string;
  condominioId: string;
  titulo: string;
  descricao: string;
  tipo: 'limpeza' | 'manutencao' | 'emergencia' | 'preventiva';
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  status: StatusOS;
  local: string;
  responsavelId?: string;
  supervisorId?: string;
  fotos: string[];
  observacoes: string;
  dataAbertura: number;
  dataPrevisao?: number;
  dataConclusao?: number;
  criadoPor: string;
  avaliacaoNota?: number;
  avaliacaoComentario?: string;
}

// ===== Checklist de Limpeza =====
export interface ItemChecklist {
  id: string;
  descricao: string;
  concluido: boolean;
  observacao?: string;
  foto?: string;
}

export interface ChecklistLimpeza {
  id: string;
  condominioId: string;
  local: string;
  tipo: 'diaria' | 'semanal' | 'mensal' | 'especial';
  itens: ItemChecklist[];
  responsavelId: string;
  supervisorId?: string;
  data: string;
  horaInicio?: number;
  horaFim?: number;
  status: 'pendente' | 'em_andamento' | 'concluido';
  assinatura?: string;
  criadoPor: string;
  criadoEm: number;
}

// ===== Escala de Trabalho =====
export interface EscalaTrabalho {
  id: string;
  condominioId: string;
  funcionarioId: string;
  diaSemana: number; // 0-6
  horaInicio: string;
  horaFim: string;
  local: string;
  funcao: string;
  ativo: boolean;
}

// ===== Materiais e Estoque =====
export interface Material {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidadeAtual: number;
  quantidadeMinima: number;
  condominioId: string;
  ultimaReposicao?: number;
  custoUnitario: number;
}

export interface MovimentacaoMaterial {
  id: string;
  materialId: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  motivo: string;
  responsavelId: string;
  data: number;
}

// ===== Inspeções =====
export interface Inspecao {
  id: string;
  condominioId: string;
  tipo: 'areas_comuns' | 'elevadores' | 'piscina' | 'garagem' | 'jardim' | 'fachada';
  local: string;
  inspetorId: string;
  data: number;
  status: 'conforme' | 'nao_conforme' | 'pendente';
  observacoes: string;
  fotos: string[];
  itensVerificados: { item: string; conforme: boolean; obs?: string }[];
  criadoEm: number;
}

// ===== Estado Global =====
export interface AppState {
  usuario: User | null;
  tema: TemaConfig;
  funcoes: FuncaoSistema[];
  carregando: boolean;
}

// ===== Props Comuns =====
export interface HowItWorksProps {
  titulo: string;
  descricao: string;
  passos: string[];
}

export interface ActionBarProps {
  onCompartilhar: () => void;
  onImprimir: () => void;
  onGerarPdf: () => void;
}

export interface GridContainerProps {
  children: React.ReactNode;
  colunas?: number;
}

// ===== Equipamentos =====
export type CategoriaEquipamento =
  | 'elevador' | 'bomba' | 'gerador' | 'hvac' | 'eletrico'
  | 'hidraulico' | 'incendio' | 'seguranca' | 'piscina'
  | 'portao' | 'interfone' | 'cftv' | 'outro';

export type StatusEquipamento = 'ativo' | 'inativo' | 'manutencao' | 'descartado';

export interface Equipamento {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  categoria: CategoriaEquipamento;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  localizacao?: string;
  andar?: string;
  dataInstalacao?: string;
  dataGarantia?: string;
  vidaUtilAnos?: number;
  potencia?: string;
  fabricante?: string;
  fornecedorId?: string;
  fornecedorNome?: string;
  manualUrl?: string;
  fotoUrl?: string;
  qrcodeId?: string;
  status: StatusEquipamento;
  observacoes?: string;
  condominioId: string;
  condominioNome?: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EquipamentoHistorico {
  id: string;
  equipamentoId: string;
  tipo: string;
  descricao: string;
  dataServico: string;
  custo: number;
  fornecedorId?: string;
  fornecedorNome?: string;
  tecnico?: string;
  osId?: string;
  fotos: string[];
  observacoes?: string;
  realizadoPor?: string;
  criadoEm: string;
}

// ===== Fornecedores =====
export type StatusFornecedor = 'ativo' | 'inativo' | 'bloqueado';
export type TipoFornecedor = 'prestador' | 'fabricante' | 'distribuidor' | 'assistencia_tecnica';

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj?: string;
  tipo: TipoFornecedor;
  especialidade?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  contatoNome?: string;
  contatoTelefone?: string;
  contatoEmail?: string;
  observacoes?: string;
  avaliacaoMedia: number;
  totalServicos: number;
  valorContrato?: number;
  dataInicioContrato?: string;
  dataFimContrato?: string;
  status: StatusFornecedor;
  condominioId: string;
  condominioNome?: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FornecedorAvaliacao {
  id: string;
  fornecedorId: string;
  osId?: string;
  nota: number;
  comentario?: string;
  avaliadoPor?: string;
  avaliadorNome?: string;
  criadoEm: string;
}

// ===== Planos de Manutenção =====
export type FrequenciaPlano = 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
export type StatusPlanoManutencao = 'ativo' | 'pausado' | 'concluido';

export interface PlanoManutencao {
  id: string;
  titulo: string;
  descricao?: string;
  equipamentoId?: string;
  equipamentoNome?: string;
  equipamentoCodigo?: string;
  categoriaEquipamento?: CategoriaEquipamento;
  frequencia: FrequenciaPlano;
  diaExecucao: number;
  itensVerificacao: { item: string; obrigatorio: boolean }[];
  responsavelId?: string;
  responsavelNome?: string;
  fornecedorId?: string;
  fornecedorNome?: string;
  custoEstimado: number;
  ultimaExecucao?: string;
  proximaExecucao?: string;
  autoGerarOs: boolean;
  status: StatusPlanoManutencao;
  condominioId: string;
  condominioNome?: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface PlanoExecucao {
  id: string;
  planoId: string;
  osId?: string;
  dataExecucao: string;
  executadoPor?: string;
  executadoPorNome?: string;
  fornecedorId?: string;
  custoReal: number;
  itensResultado: { item: string; conforme: boolean; obs?: string }[];
  observacoes?: string;
  fotos: string[];
  status: string;
  criadoEm: string;
}

// ===== Custos =====
export interface CustoOS {
  id: string;
  titulo: string;
  status: string;
  prioridade: string;
  tipo: string;
  custoMaterial: number;
  custoMaoObra: number;
  custoTerceiros: number;
  custoTotal: number;
  tempoExecucaoMin: number;
  dataAbertura: string;
  dataConclusao?: string;
  condominioNome: string;
  equipamentoNome?: string;
  equipamentoCodigo?: string;
  fornecedorNome?: string;
}

export interface ResumoCustos {
  totalOs: number;
  totalMaterial: number;
  totalMaoObra: number;
  totalTerceiros: number;
  totalGeral: number;
  mediaPorOs: number;
}

export interface CustoPorGrupo {
  nome?: string;
  id?: string;
  categoria?: string;
  total: number;
  quantidade: number;
}

export interface EvolucaoCusto {
  mes: string;
  material: number;
  maoObra: number;
  terceiros: number;
  total: number;
  quantidade: number;
}

export interface CustoPorEquipamento {
  id: string;
  nome: string;
  codigo: string;
  categoria: string;
  total: number;
  quantidadeOs: number;
  media: number;
}

// ===== KPIs =====
export interface KPIsManutencao {
  mtbf: number;
  mttr: number;
  disponibilidade: number;
  backlog: number;
  custoTotal: number;
  custoMedio: number;
  osConcluidas: number;
  osAbertas: number;
  taxaConclusao: number;
  preventivasVsCorretivas: { preventivas: number; corretivas: number };
  tempoMedioResposta: number;
  reincidencia: number;
  totalEquipamentos?: number;
}

export interface KPIEquipamento {
  id: string;
  nome: string;
  codigo: string;
  categoria: string;
  status: string;
  totalOs: number;
  osConcluidas: number;
  corretivas: number;
  preventivas: number;
  custoTotal: number;
  tempoMedio: number;
  ultimaOs?: string;
}

export interface TendenciaKPI {
  mes: string;
  total: number;
  concluidas: number;
  preventivas: number;
  custo: number;
  tempoMedio: number;
}

// ===== Documentação Técnica =====
export type TipoDocumento = 'manual' | 'certificado' | 'garantia' | 'laudo'
  | 'projeto' | 'planta' | 'contrato' | 'nota_fiscal'
  | 'relatorio_inspecao' | 'art' | 'alvara' | 'outro';

export type StatusDocumento = 'vigente' | 'vencido' | 'revogado' | 'rascunho';

export interface DocumentoTecnico {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: TipoDocumento;
  status: StatusDocumento;
  arquivoUrl: string;
  arquivoNome: string;
  arquivoTamanho: number;
  arquivoTipo?: string;
  condominioId: string;
  condominioNome?: string;
  equipamentoId?: string;
  equipamentoNome?: string;
  equipamentoCodigo?: string;
  fornecedorId?: string;
  fornecedorNome?: string;
  planoId?: string;
  planoTitulo?: string;
  dataEmissao?: string;
  dataValidade?: string;
  tags: string[];
  versao: string;
  observacoes?: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ResumoDocumentos {
  total: number;
  porTipo: { tipo: string; quantidade: number }[];
  vencidos: number;
  aVencer30: number;
}

// ===== Portal do Morador =====
export type TipoSolicitacao = 'manutencao' | 'reclamacao' | 'sugestao' | 'informacao' | 'reserva';
export type StatusSolicitacao = 'aberta' | 'em_analise' | 'em_andamento' | 'resolvida' | 'cancelada';

export interface MoradorPortal {
  id: string;
  nome: string;
  email: string;
  condominioId: string;
  bloco?: string;
  apartamento?: string;
  whatsapp?: string;
  perfil: string;
  avatarUrl?: string;
  condominioNome?: string;
  criadoEm?: string;
}

export interface SolicitacaoMorador {
  id: number;
  protocolo: string;
  moradorId: string;
  condominioId: string;
  tipo: TipoSolicitacao;
  titulo: string;
  descricao?: string;
  fotos?: string[];
  local?: string;
  status: StatusSolicitacao;
  resposta?: string;
  respondidoPor?: string;
  respondidoPorNome?: string;
  respondidoEm?: string;
  ordemServicoId?: string;
  criadoEm: string;
  atualizadoEm: string;
  // Campos join (staff view)
  moradorNome?: string;
  moradorEmail?: string;
  condominioNome?: string;
  bloco?: string;
  apartamento?: string;
  moradorWhatsapp?: string;
}

export interface ResumoSolicitacoes {
  total: number;
  abertas: number;
  emAndamento: number;
  resolvidas: number;
  porTipo: { tipo: string; total: number }[];
}

export interface ResumoPortal {
  condominioNome: string;
  comunicadosTotal: number;
  solicitacoesTotal: number;
  solicitacoesAbertas: number;
  solicitacoesEmAndamento: number;
  solicitacoesResolvidas: number;
}

// ===== SLA =====
export type PrioridadeSla = 'urgente' | 'alta' | 'media' | 'baixa';
export type SlaStatus = 'dentro_prazo' | 'em_risco' | 'violado';

export interface SlaConfiguracao {
  id: string;
  condominioId: string;
  condominioNome?: string;
  prioridade: PrioridadeSla;
  tempoRespostaHoras: number;
  tempoResolucaoHoras: number;
  notificarAlerta: boolean;
  notificarViolacao: boolean;
}

export interface SlaDashboard {
  totalAbertas: number;
  dentroPrazo: number;
  emRisco: number;
  violadas: number;
  taxaCumprimento: number;
  porPrioridade: { prioridade: string; dentroPrazo: number; emRisco: number; violadas: number }[];
}

export interface SlaViolacao {
  id: string;
  protocolo: string;
  titulo: string;
  prioridade: string;
  status: string;
  slaStatus: SlaStatus;
  slaRespostaLimite?: string;
  slaResolucaoLimite?: string;
  dataAbertura: string;
  condominioNome?: string;
  responsavelNome?: string;
}

// ===== WhatsApp =====
export interface WhatsAppConfig {
  id: string;
  condominioId: string;
  apiUrl?: string;
  apiToken?: string;
  numeroRemetente?: string;
  ativo: boolean;
  notificarOsCriada: boolean;
  notificarOsConcluida: boolean;
  notificarVencimentos: boolean;
  notificarComunicados: boolean;
}

export interface WhatsAppMensagem {
  id: string;
  condominioId: string;
  destinatario: string;
  mensagem: string;
  tipo: string;
  status: string;
  erro?: string;
  enviadoEm?: string;
  criadoEm: string;
}

// ===== Orçamentos =====
export interface OrcamentoItem {
  id?: string;
  orcamentoId?: string;
  descricao: string;
  tipo: 'material' | 'servico' | 'mao_de_obra';
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
  ordem: number;
}

export interface OrcamentoFoto {
  id?: string;
  orcamentoId?: string;
  url: string;
  legenda: string;
  ordem: number;
  criadoEm?: string;
}

export interface Orcamento {
  id: string;
  condominioId: string;
  numero: number;
  titulo: string;
  clienteNome?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  clienteEndereco?: string;
  descricaoGeral?: string;
  observacoes?: string;
  condicoesPagamento?: string;
  validadeDias: number;
  prazoExecucao?: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expirado';
  valorTotal: number;
  descontoTipo: 'nenhum' | 'percentual' | 'valor';
  descontoValor: number;
  valorFinal: number;
  logoUrl?: string;
  osReferencia?: string;
  criadoPor: string;
  condominioNome?: string;
  criadorNome?: string;
  itens?: OrcamentoItem[];
  fotos?: OrcamentoFoto[];
  criadoEm: string;
  atualizadoEm: string;
}
