-- Chave por condomínio: ao criar OS, notificar automaticamente os funcionários no app
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS os_auto_notificar BOOLEAN NOT NULL DEFAULT false;
