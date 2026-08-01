CREATE TABLE IF NOT EXISTS os_responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  papel VARCHAR(30) NOT NULL DEFAULT 'usuario',
  definido_por_nome VARCHAR(255),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_os_resp_os ON os_responsaveis(os_id);
CREATE INDEX IF NOT EXISTS idx_os_resp_usuario ON os_responsaveis(usuario_id) WHERE usuario_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_os_resp_unico_usuario ON os_responsaveis(os_id, usuario_id) WHERE usuario_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_os_resp_unico_nome ON os_responsaveis(os_id, nome) WHERE usuario_id IS NULL;

CREATE TABLE IF NOT EXISTS os_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL,
  texto TEXT,
  dados JSONB NOT NULL DEFAULT '{}',
  autor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_nome VARCHAR(255) NOT NULL,
  origem VARCHAR(10) NOT NULL DEFAULT 'painel',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_os_hist_os ON os_historico(os_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS os_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  legenda VARCHAR(255),
  autor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  autor_nome VARCHAR(255) NOT NULL,
  origem VARCHAR(10) NOT NULL DEFAULT 'painel',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_os_fotos_os ON os_fotos(os_id, criado_em);

DO $backfill_resp$
BEGIN
  EXECUTE $sql$
    INSERT INTO os_responsaveis (os_id, usuario_id, nome, papel, definido_por_nome)
    SELECT os.id, os.responsavel_id, u.nome, 'usuario', 'Sistema'
      FROM ordens_servico os
      JOIN usuarios u ON u.id = os.responsavel_id
     WHERE os.responsavel_id IS NOT NULL
    ON CONFLICT DO NOTHING
  $sql$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'backfill os_responsaveis ignorado: %', SQLERRM;
END
$backfill_resp$;

DO $backfill_fotos$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'ordens_servico' AND column_name = 'fotos'
  ) THEN
    EXECUTE $sql$
      INSERT INTO os_fotos (os_id, url, autor_nome, origem)
      SELECT os.id, f, 'Sistema', 'painel'
        FROM ordens_servico os, unnest(os.fotos) AS f
       WHERE os.fotos IS NOT NULL AND f <> ''
    $sql$;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'backfill os_fotos ignorado: %', SQLERRM;
END
$backfill_fotos$;
