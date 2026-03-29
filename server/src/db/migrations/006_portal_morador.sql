-- ════════════════════════════════════════════════════════════════
-- MIGRATION 006 — Portal do Morador
-- Adiciona autenticação de moradores + tabela de solicitações
-- ════════════════════════════════════════════════════════════════

-- ── Novos campos na tabela moradores ──
ALTER TABLE moradores ADD COLUMN IF NOT EXISTS senha TEXT;
ALTER TABLE moradores ADD COLUMN IF NOT EXISTS token_acesso UUID DEFAULT gen_random_uuid();
ALTER TABLE moradores ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE moradores ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE moradores ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;

-- ── Índices para moradores ──
CREATE INDEX IF NOT EXISTS idx_moradores_email ON moradores(email);
CREATE INDEX IF NOT EXISTS idx_moradores_token_acesso ON moradores(token_acesso);
CREATE INDEX IF NOT EXISTS idx_moradores_ativo ON moradores(ativo);

-- ── Enum: tipo de solicitação ──
DO $$ BEGIN
  CREATE TYPE tipo_solicitacao AS ENUM (
    'manutencao', 'reclamacao', 'sugestao', 'informacao', 'reserva'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Enum: status da solicitação ──
DO $$ BEGIN
  CREATE TYPE status_solicitacao AS ENUM (
    'aberta', 'em_analise', 'em_andamento', 'resolvida', 'cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Tabela: solicitacoes_morador ──
CREATE TABLE IF NOT EXISTS solicitacoes_morador (
  id            SERIAL PRIMARY KEY,
  protocolo     VARCHAR(20) UNIQUE NOT NULL,
  morador_id    UUID NOT NULL REFERENCES moradores(id) ON DELETE CASCADE,
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  tipo          tipo_solicitacao NOT NULL DEFAULT 'informacao',
  titulo        VARCHAR(200) NOT NULL,
  descricao     TEXT,
  fotos         TEXT[],
  local         VARCHAR(200),
  status        status_solicitacao NOT NULL DEFAULT 'aberta',
  resposta      TEXT,
  respondido_por UUID REFERENCES usuarios(id),
  respondido_em TIMESTAMPTZ,
  ordem_servico_id UUID REFERENCES ordens_servico(id),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Índices ──
CREATE INDEX IF NOT EXISTS idx_solicitacoes_morador_id ON solicitacoes_morador(morador_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_condominio_id ON solicitacoes_morador(condominio_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes_morador(status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_tipo ON solicitacoes_morador(tipo);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_criado_em ON solicitacoes_morador(criado_em DESC);
