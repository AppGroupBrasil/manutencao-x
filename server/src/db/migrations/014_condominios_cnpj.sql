-- Coluna cnpj referenciada nas rotas POST/PUT /api/condominios desde f279d40, mas nunca criada
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20);
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS login_titulo VARCHAR(255);
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS login_subtitulo VARCHAR(255);
ALTER TABLE condominios ALTER COLUMN telefone TYPE VARCHAR(30);
