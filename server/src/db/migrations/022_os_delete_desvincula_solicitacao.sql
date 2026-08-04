DO $$
DECLARE
  nome_constraint TEXT;
BEGIN
  IF to_regclass('public.solicitacoes_morador') IS NULL THEN
    RETURN;
  END IF;

  SELECT conname INTO nome_constraint
    FROM pg_constraint
   WHERE conrelid = 'public.solicitacoes_morador'::regclass
     AND contype = 'f'
     AND confrelid = 'public.ordens_servico'::regclass
   LIMIT 1;

  IF nome_constraint IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE solicitacoes_morador DROP CONSTRAINT %I', nome_constraint);
  ALTER TABLE solicitacoes_morador
    ADD CONSTRAINT solicitacoes_morador_ordem_servico_id_fkey
    FOREIGN KEY (ordem_servico_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;
END
$$;
