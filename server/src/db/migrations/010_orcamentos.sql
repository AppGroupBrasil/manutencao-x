-- Migration 010: Módulo de Orçamentos
-- Tabelas para criação, gestão e envio de orçamentos profissionais

CREATE TABLE IF NOT EXISTS orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id UUID NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  numero SERIAL,
  titulo VARCHAR(255) NOT NULL,
  cliente_nome VARCHAR(255),
  cliente_telefone VARCHAR(30),
  cliente_email VARCHAR(255),
  cliente_endereco VARCHAR(500),
  descricao_geral TEXT,
  observacoes TEXT,
  condicoes_pagamento VARCHAR(500),
  validade_dias INT DEFAULT 30,
  prazo_execucao VARCHAR(255),
  status VARCHAR(30) DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aprovado','recusado','expirado')),
  valor_total NUMERIC(12,2) DEFAULT 0,
  desconto_tipo VARCHAR(20) DEFAULT 'nenhum' CHECK (desconto_tipo IN ('nenhum','percentual','valor')),
  desconto_valor NUMERIC(12,2) DEFAULT 0,
  valor_final NUMERIC(12,2) DEFAULT 0,
  logo_url VARCHAR(500),
  os_referencia VARCHAR(255),
  criado_por UUID NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  descricao VARCHAR(500) NOT NULL,
  tipo VARCHAR(30) DEFAULT 'servico' CHECK (tipo IN ('material','servico','mao_de_obra')),
  quantidade NUMERIC(10,2) DEFAULT 1,
  unidade VARCHAR(30) DEFAULT 'un',
  valor_unitario NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  ordem INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orcamento_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  legenda VARCHAR(255),
  ordem INT DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_orcamentos_condominio ON orcamentos(condominio_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_criado_por ON orcamentos(criado_por);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento ON orcamento_itens(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_fotos_orcamento ON orcamento_fotos(orcamento_id);
