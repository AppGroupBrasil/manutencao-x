-- Correções do check-up: coluna atualizado_em, larguras compatíveis com validação Zod,
-- tabela de registros Antes/Depois (checklists e vistorias)

ALTER TABLE tarefas_agendadas ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ;

ALTER TABLE moradores ALTER COLUMN whatsapp TYPE VARCHAR(30);
ALTER TABLE fornecedores ALTER COLUMN telefone TYPE VARCHAR(30);
ALTER TABLE fornecedores ALTER COLUMN contato_telefone TYPE VARCHAR(30);
ALTER TABLE escalas ALTER COLUMN hora_inicio TYPE VARCHAR(10);
ALTER TABLE escalas ALTER COLUMN hora_fim TYPE VARCHAR(10);
ALTER TABLE materiais ALTER COLUMN unidade TYPE VARCHAR(50);

CREATE TABLE IF NOT EXISTS registros_antes_depois (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  checklist_id UUID REFERENCES checklists(id) ON DELETE SET NULL,
  vistoria_id UUID REFERENCES vistorias(id) ON DELETE SET NULL,
  item_id VARCHAR(100),
  item_desc TEXT,
  foto_antes TEXT,
  desc_antes TEXT,
  foto_depois TEXT,
  desc_depois TEXT,
  criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_antes_depois_cond ON registros_antes_depois(condominio_id, criado_em DESC);
