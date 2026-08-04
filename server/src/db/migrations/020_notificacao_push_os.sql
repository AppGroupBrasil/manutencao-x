-- Chave de push por usuario (a de e-mail, notificar_os_email, veio na 018)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS notificar_os_push BOOLEAN NOT NULL DEFAULT true;
