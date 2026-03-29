-- Migration 009: Performance indexes + atualizado_em triggers
-- Indexes para colunas frequentemente consultadas

-- ordens_servico
CREATE INDEX IF NOT EXISTS idx_ordens_servico_criado_por ON ordens_servico(criado_por);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_data_abertura ON ordens_servico(data_abertura);

-- sla_registros
CREATE INDEX IF NOT EXISTS idx_sla_registros_condominio ON sla_registros(condominio_id);

-- leituras_qrcode
CREATE INDEX IF NOT EXISTS idx_leituras_qrcode_funcionario ON leituras_qrcode(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_leituras_qrcode_data ON leituras_qrcode(data_hora);

-- equipamentos_historico
CREATE INDEX IF NOT EXISTS idx_equip_historico_fornecedor ON equipamentos_historico(fornecedor_id);

-- planos_execucoes
CREATE INDEX IF NOT EXISTS idx_planos_exec_executado ON planos_execucoes(executado_por);

-- fornecedores_contratos
CREATE INDEX IF NOT EXISTS idx_contratos_criado_por ON fornecedores_contratos(criado_por);

-- roteiros
CREATE INDEX IF NOT EXISTS idx_roteiros_condominio ON roteiros(condominio_id);

-- fornecedores
CREATE INDEX IF NOT EXISTS idx_fornecedores_condominio ON fornecedores(condominio_id);

-- equipamentos
CREATE INDEX IF NOT EXISTS idx_equipamentos_condominio ON equipamentos(condominio_id);

-- Triggers para atualizado_em automático
CREATE OR REPLACE FUNCTION update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'fornecedores',
    'equipamentos',
    'planos_manutencao',
    'fornecedores_contratos'
  ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = t AND column_name = 'atualizado_em'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trigger_atualizado_em_%s ON %I; CREATE TRIGGER trigger_atualizado_em_%s BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_atualizado_em();',
        t, t, t, t
      );
    END IF;
  END LOOP;
END;
$$;
