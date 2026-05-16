-- Índices compostos para queries quentes + tabela de refresh tokens

CREATE INDEX IF NOT EXISTS idx_os_cond_status_data
  ON ordens_servico (condominio_id, status, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_os_responsavel
  ON ordens_servico (responsavel_id, status)
  WHERE responsavel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notif_user_lida_data
  ON notificacoes (user_id, lida, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_audit_entidade
  ON audit_logs (entidade, entidade_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user_data
  ON audit_logs (user_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_metricas_user_data
  ON metricas_uso (user_id, data DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revogado BOOLEAN NOT NULL DEFAULT false,
  user_agent VARCHAR(500),
  ip VARCHAR(45),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usado_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_hash ON refresh_tokens(token_hash) WHERE revogado = false;
