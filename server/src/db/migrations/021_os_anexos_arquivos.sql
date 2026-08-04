ALTER TABLE os_fotos ADD COLUMN IF NOT EXISTS nome VARCHAR(255);
ALTER TABLE os_fotos ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) NOT NULL DEFAULT 'imagem';

UPDATE os_fotos SET tipo = 'arquivo' WHERE tipo = 'imagem' AND url ILIKE '%.pdf';
