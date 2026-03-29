-- ╔══════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 004: Custos e KPIs de Manutenção               ║
-- ║  Índices e colunas auxiliares para performance             ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Coluna custo_total computada nas ordens
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS custo_total DECIMAL(12,2)
  GENERATED ALWAYS AS (COALESCE(custo_material,0) + COALESCE(custo_mao_obra,0) + COALESCE(custo_terceiros,0)) STORED;

-- Índices para consultas de custo e KPIs
CREATE INDEX IF NOT EXISTS idx_os_custo_data ON ordens_servico (data_abertura DESC) WHERE custo_total > 0;
CREATE INDEX IF NOT EXISTS idx_os_condominio_status ON ordens_servico (condominio_id, status);
CREATE INDEX IF NOT EXISTS idx_os_equipamento ON ordens_servico (equipamento_id) WHERE equipamento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_os_custo_total ON ordens_servico (custo_total) WHERE custo_total > 0;
CREATE INDEX IF NOT EXISTS idx_eq_hist_equip ON equipamentos_historico (equipamento_id, data_servico);
CREATE INDEX IF NOT EXISTS idx_planos_exec_plano ON planos_execucoes (plano_id, data_execucao);
