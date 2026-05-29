-- Migration 013: formalizar tabela respostas_qrcode e corrigir defaults de plano

-- Tabela respostas_qrcode (antes criada dinamicamente em qrcodes.ts)
CREATE TABLE IF NOT EXISTS respostas_qrcode (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qrcode_id UUID NOT NULL REFERENCES qrcodes(id) ON DELETE CASCADE,
  qrcode_nome VARCHAR(255),
  identificacao JSONB,
  respostas JSONB NOT NULL DEFAULT '{}',
  respondido_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  respondido_por_nome VARCHAR(255),
  respondido_por_email VARCHAR(255),
  respondido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  endereco TEXT
);

CREATE INDEX IF NOT EXISTS idx_respostas_qrcode_qrcode_id ON respostas_qrcode(qrcode_id);
CREATE INDEX IF NOT EXISTS idx_respostas_qrcode_respondido_em ON respostas_qrcode(respondido_em DESC);

-- Corrigir default de plano/status_plano para não usar 'teste' em novos registros
ALTER TABLE condominios ALTER COLUMN plano SET DEFAULT 'gratis';
ALTER TABLE condominios ALTER COLUMN status_plano SET DEFAULT 'ativo';
