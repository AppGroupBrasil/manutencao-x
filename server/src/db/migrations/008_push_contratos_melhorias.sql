-- ╔══════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 008: Push Notifications, Contratos, Melhorias  ║
-- ║  Web Push subscriptions + Gestão de contratos              ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════
-- Push Notifications: Subscriptions
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  subscription JSONB NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);

-- ════════════════════════════════════════════
-- Contratos de Fornecedores: Gestão dedicada
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fornecedores_contratos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  numero_contrato VARCHAR(100),
  descricao TEXT,
  valor DECIMAL(12,2),
  data_inicio DATE,
  data_fim DATE,
  renovacao_automatica BOOLEAN DEFAULT false,
  alerta_dias_antes INT DEFAULT 30,
  status VARCHAR(20) DEFAULT 'vigente',
  documento_url TEXT,
  observacoes TEXT,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contratos_fornecedor ON fornecedores_contratos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contratos_condominio ON fornecedores_contratos(condominio_id);
CREATE INDEX IF NOT EXISTS idx_contratos_data_fim ON fornecedores_contratos(data_fim);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON fornecedores_contratos(status);

-- ════════════════════════════════════════════
-- Tabela reset_tokens (normalizar — antes era CREATE IF NOT EXISTS no runtime)
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON reset_tokens(user_id);
