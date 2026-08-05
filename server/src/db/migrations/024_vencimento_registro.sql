ALTER TABLE vencimentos ADD COLUMN IF NOT EXISTS registro_descricao TEXT;

CREATE TABLE IF NOT EXISTS vencimento_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vencimento_id UUID NOT NULL REFERENCES vencimentos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  nome VARCHAR(255),
  tipo VARCHAR(10) NOT NULL DEFAULT 'imagem',
  fase VARCHAR(10) NOT NULL DEFAULT 'antes',
  autor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_nome VARCHAR(255) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venc_anexos ON vencimento_anexos(vencimento_id, criado_em);
