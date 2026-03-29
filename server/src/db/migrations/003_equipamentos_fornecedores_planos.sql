-- ╔══════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 003: Equipamentos, Fornecedores, Planos        ║
-- ║  Módulos de Manutenção Predial Completa                   ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════
-- ENUM TYPES
-- ════════════════════════════════════════════

CREATE TYPE categoria_equipamento AS ENUM (
  'elevador', 'bomba', 'gerador', 'hvac', 'eletrico',
  'hidraulico', 'incendio', 'seguranca', 'piscina',
  'portao', 'interfone', 'cftv', 'outro'
);

CREATE TYPE status_equipamento AS ENUM ('ativo', 'inativo', 'manutencao', 'descartado');

CREATE TYPE status_fornecedor AS ENUM ('ativo', 'inativo', 'bloqueado');

CREATE TYPE tipo_fornecedor AS ENUM ('prestador', 'fabricante', 'distribuidor', 'assistencia_tecnica');

CREATE TYPE frequencia_plano AS ENUM ('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual');

CREATE TYPE status_plano_manutencao AS ENUM ('ativo', 'pausado', 'concluido');

-- ════════════════════════════════════════════
-- TABELA: fornecedores
-- ════════════════════════════════════════════

CREATE TABLE fornecedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20),
  tipo tipo_fornecedor NOT NULL DEFAULT 'prestador',
  especialidade VARCHAR(255),
  telefone VARCHAR(20),
  email VARCHAR(255),
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  contato_nome VARCHAR(255),
  contato_telefone VARCHAR(20),
  contato_email VARCHAR(255),
  observacoes TEXT,
  avaliacao_media DECIMAL(3,2) DEFAULT 0,
  total_servicos INT DEFAULT 0,
  valor_contrato DECIMAL(12,2),
  data_inicio_contrato DATE,
  data_fim_contrato DATE,
  status status_fornecedor NOT NULL DEFAULT 'ativo',
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fornecedores_condominio ON fornecedores(condominio_id);
CREATE INDEX idx_fornecedores_status ON fornecedores(status);
CREATE INDEX idx_fornecedores_tipo ON fornecedores(tipo);

-- ════════════════════════════════════════════
-- TABELA: equipamentos
-- ════════════════════════════════════════════

CREATE TABLE equipamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  categoria categoria_equipamento NOT NULL DEFAULT 'outro',
  marca VARCHAR(100),
  modelo VARCHAR(100),
  numero_serie VARCHAR(100),
  localizacao VARCHAR(255),
  andar VARCHAR(20),
  data_instalacao DATE,
  data_garantia DATE,
  vida_util_anos INT,
  potencia VARCHAR(50),
  fabricante VARCHAR(255),
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  manual_url TEXT,
  foto_url TEXT,
  qrcode_id UUID REFERENCES qrcodes(id) ON DELETE SET NULL,
  status status_equipamento NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_equipamentos_condominio ON equipamentos(condominio_id);
CREATE INDEX idx_equipamentos_categoria ON equipamentos(categoria);
CREATE INDEX idx_equipamentos_status ON equipamentos(status);
CREATE INDEX idx_equipamentos_fornecedor ON equipamentos(fornecedor_id);

-- ════════════════════════════════════════════
-- TABELA: equipamentos_historico (histórico de manutenções)
-- ════════════════════════════════════════════

CREATE TABLE equipamentos_historico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  equipamento_id UUID NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL DEFAULT 'manutencao',
  descricao TEXT NOT NULL,
  data_servico DATE NOT NULL DEFAULT CURRENT_DATE,
  custo DECIMAL(12,2) DEFAULT 0,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome VARCHAR(255),
  tecnico VARCHAR(255),
  os_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
  fotos TEXT[] DEFAULT '{}',
  observacoes TEXT,
  realizado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_equip_hist_equipamento ON equipamentos_historico(equipamento_id);
CREATE INDEX idx_equip_hist_data ON equipamentos_historico(data_servico);

-- ════════════════════════════════════════════
-- TABELA: fornecedores_avaliacoes
-- ════════════════════════════════════════════

CREATE TABLE fornecedores_avaliacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  os_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
  nota INT NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT,
  avaliado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forn_aval_fornecedor ON fornecedores_avaliacoes(fornecedor_id);

-- ════════════════════════════════════════════
-- TABELA: planos_manutencao
-- ════════════════════════════════════════════

CREATE TABLE planos_manutencao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  equipamento_id UUID REFERENCES equipamentos(id) ON DELETE CASCADE,
  categoria_equipamento categoria_equipamento,
  frequencia frequencia_plano NOT NULL DEFAULT 'mensal',
  dia_execucao INT DEFAULT 1,
  itens_verificacao JSONB NOT NULL DEFAULT '[]',
  responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  custo_estimado DECIMAL(12,2) DEFAULT 0,
  ultima_execucao DATE,
  proxima_execucao DATE,
  auto_gerar_os BOOLEAN DEFAULT true,
  status status_plano_manutencao NOT NULL DEFAULT 'ativo',
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_planos_condominio ON planos_manutencao(condominio_id);
CREATE INDEX idx_planos_equipamento ON planos_manutencao(equipamento_id);
CREATE INDEX idx_planos_status ON planos_manutencao(status);
CREATE INDEX idx_planos_proxima ON planos_manutencao(proxima_execucao);

-- ════════════════════════════════════════════
-- TABELA: planos_execucoes (registro de cada execução do plano)
-- ════════════════════════════════════════════

CREATE TABLE planos_execucoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plano_id UUID NOT NULL REFERENCES planos_manutencao(id) ON DELETE CASCADE,
  os_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
  data_execucao DATE NOT NULL DEFAULT CURRENT_DATE,
  executado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  executado_por_nome VARCHAR(255),
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  custo_real DECIMAL(12,2) DEFAULT 0,
  itens_resultado JSONB NOT NULL DEFAULT '[]',
  observacoes TEXT,
  fotos TEXT[] DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'concluida',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_planos_exec_plano ON planos_execucoes(plano_id);
CREATE INDEX idx_planos_exec_data ON planos_execucoes(data_execucao);

-- ════════════════════════════════════════════
-- Colunas adicionais em ordens_servico para custo
-- ════════════════════════════════════════════

ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS equipamento_id UUID REFERENCES equipamentos(id) ON DELETE SET NULL;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES planos_manutencao(id) ON DELETE SET NULL;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS custo_material DECIMAL(12,2) DEFAULT 0;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS custo_mao_obra DECIMAL(12,2) DEFAULT 0;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS custo_terceiros DECIMAL(12,2) DEFAULT 0;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS tempo_execucao_min INT;
