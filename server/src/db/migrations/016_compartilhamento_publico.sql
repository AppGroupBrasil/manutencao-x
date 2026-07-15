ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS executado_por_nome VARCHAR(255);
ALTER TABLE checklists ADD COLUMN IF NOT EXISTS executado_por_nome VARCHAR(255);
ALTER TABLE quadro_atividades ADD COLUMN IF NOT EXISTS executado_por_nome VARCHAR(255);
