-- ╔══════════════════════════════════════════════════════════════╗
-- ║  MIGRATION 007: SLA, Scheduler, WhatsApp, Calendário      ║
-- ║  Melhorias P5: Controle SLA, Agendamento, Integrações     ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════
-- SLA: Configurações por condomínio
-- ════════════════════════════════════════════

CREATE TYPE prioridade_sla AS ENUM ('urgente', 'alta', 'media', 'baixa');

CREATE TABLE sla_configuracoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  prioridade prioridade_sla NOT NULL,
  tempo_resposta_horas INT NOT NULL DEFAULT 4,
  tempo_resolucao_horas INT NOT NULL DEFAULT 48,
  notificar_alerta BOOLEAN DEFAULT true,
  notificar_violacao BOOLEAN DEFAULT true,
  criado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(condominio_id, prioridade)
);

CREATE INDEX idx_sla_config_condominio ON sla_configuracoes(condominio_id);

-- Defaults: urgente=2h/12h, alta=4h/24h, media=8h/48h, baixa=24h/120h
-- (serão criados via seed ou na primeira configuração)

-- SLA: Campos adicionais nas ordens de serviço
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS sla_resposta_limite TIMESTAMPTZ;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS sla_resolucao_limite TIMESTAMPTZ;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS sla_respondido_em TIMESTAMPTZ;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'dentro_prazo';

CREATE INDEX idx_os_sla_status ON ordens_servico(sla_status);

-- ════════════════════════════════════════════
-- Scheduler: Log de execuções automáticas
-- ════════════════════════════════════════════

CREATE TABLE scheduler_execucoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(50) NOT NULL,
  plano_id UUID REFERENCES planos_manutencao(id) ON DELETE SET NULL,
  os_gerada_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sucesso',
  detalhes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduler_tipo ON scheduler_execucoes(tipo);
CREATE INDEX idx_scheduler_criado ON scheduler_execucoes(criado_em);

-- ════════════════════════════════════════════
-- WhatsApp: Configurações e log de mensagens
-- ════════════════════════════════════════════

CREATE TABLE whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  api_url TEXT,
  api_token TEXT,
  numero_remetente VARCHAR(20),
  ativo BOOLEAN DEFAULT false,
  notificar_os_criada BOOLEAN DEFAULT true,
  notificar_os_concluida BOOLEAN DEFAULT true,
  notificar_vencimentos BOOLEAN DEFAULT true,
  notificar_comunicados BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(condominio_id)
);

CREATE TABLE whatsapp_mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  destinatario VARCHAR(20) NOT NULL,
  mensagem TEXT NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'texto',
  status VARCHAR(20) NOT NULL DEFAULT 'pendente',
  erro TEXT,
  enviado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_msg_condominio ON whatsapp_mensagens(condominio_id);
CREATE INDEX idx_whatsapp_msg_status ON whatsapp_mensagens(status);
