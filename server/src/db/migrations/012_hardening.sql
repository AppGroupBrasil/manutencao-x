-- Hardening: reset_tokens, token_acesso de moradores, índices de purge

CREATE TABLE IF NOT EXISTS reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON reset_tokens(expires_at) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON reset_tokens(user_id);

-- Expiração e flag de uso para token de primeiro acesso do morador
ALTER TABLE moradores ADD COLUMN IF NOT EXISTS token_acesso_expira_em TIMESTAMPTZ;
ALTER TABLE moradores ADD COLUMN IF NOT EXISTS token_acesso_usado BOOLEAN NOT NULL DEFAULT false;

-- Índices de purge / expiração
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_criado ON login_attempts(criado_em);
CREATE INDEX IF NOT EXISTS idx_audit_logs_criado ON audit_logs(criado_em);
CREATE INDEX IF NOT EXISTS idx_metricas_uso_data ON metricas_uso(data);

-- Quota de upload por usuário (defesa contra abuso)
CREATE TABLE IF NOT EXISTS upload_quotas (
  user_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  arquivos_dia INT NOT NULL DEFAULT 0,
  bytes_dia BIGINT NOT NULL DEFAULT 0,
  janela_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
