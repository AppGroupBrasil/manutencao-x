-- Migration: Adiciona campos de plano/status aos condomínios
-- Data: 2025-01-XX
-- Executar no banco de produção ANTES do deploy

ALTER TABLE condominios ADD COLUMN IF NOT EXISTS plano VARCHAR(20) DEFAULT 'teste';
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS status_plano VARCHAR(20) DEFAULT 'teste';
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS data_inicio_teste TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS data_fim_teste TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 days');
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS valor_mensalidade DECIMAL(10,2) DEFAULT 0;

-- Atualizar condominios existentes para status 'ativo'
UPDATE condominios SET status_plano = 'ativo', plano = 'basico' WHERE ativo = true AND status_plano = 'teste';
