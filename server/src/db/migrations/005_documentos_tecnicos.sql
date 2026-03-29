-- ╔══════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 005: Documentação Técnica                      ║
-- ║  Gestão de documentos técnicos de manutenção              ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════
-- ENUM TYPES
-- ════════════════════════════════════════════

CREATE TYPE tipo_documento AS ENUM (
  'manual', 'certificado', 'garantia', 'laudo',
  'projeto', 'planta', 'contrato', 'nota_fiscal',
  'relatorio_inspecao', 'art', 'alvara', 'outro'
);

CREATE TYPE status_documento AS ENUM ('vigente', 'vencido', 'revogado', 'rascunho');

-- ════════════════════════════════════════════
-- TABELA: documentos_tecnicos
-- ════════════════════════════════════════════

CREATE TABLE documentos_tecnicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo tipo_documento NOT NULL DEFAULT 'outro',
  status status_documento NOT NULL DEFAULT 'vigente',
  arquivo_url TEXT NOT NULL,
  arquivo_nome VARCHAR(255) NOT NULL,
  arquivo_tamanho INT DEFAULT 0,
  arquivo_tipo VARCHAR(100),

  -- Vínculos (pelo menos um deve estar preenchido)
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  equipamento_id UUID REFERENCES equipamentos(id) ON DELETE SET NULL,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  plano_id UUID REFERENCES planos_manutencao(id) ON DELETE SET NULL,

  -- Datas de validade
  data_emissao DATE,
  data_validade DATE,

  -- Tags para busca
  tags TEXT[] DEFAULT '{}',

  -- Metadados
  versao VARCHAR(20) DEFAULT '1.0',
  observacoes TEXT,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_docs_condominio ON documentos_tecnicos(condominio_id);
CREATE INDEX idx_docs_equipamento ON documentos_tecnicos(equipamento_id) WHERE equipamento_id IS NOT NULL;
CREATE INDEX idx_docs_fornecedor ON documentos_tecnicos(fornecedor_id) WHERE fornecedor_id IS NOT NULL;
CREATE INDEX idx_docs_plano ON documentos_tecnicos(plano_id) WHERE plano_id IS NOT NULL;
CREATE INDEX idx_docs_tipo ON documentos_tecnicos(tipo);
CREATE INDEX idx_docs_status ON documentos_tecnicos(status);
CREATE INDEX idx_docs_validade ON documentos_tecnicos(data_validade) WHERE data_validade IS NOT NULL;
