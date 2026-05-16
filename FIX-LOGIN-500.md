# FIX: Login retornando erro 500 em produção

## Causa Raiz

A tabela `login_attempts` não existe no banco de dados de produção.  
A rota `/api/auth/login` chama `checkRateLimit()` que faz `SELECT COUNT(*) FROM login_attempts ...`  
→ PostgreSQL lança exceção "relation does not exist" → catch retorna HTTP 500.

A migração `002_audit_notifications_metrics.sql` define esta tabela mas nunca foi aplicada em produção.

## Correção Imediata

SSH no servidor Hetzner e execute:

```bash
ssh -i <CHAVE_SSH> root@<IP_DO_SERVIDOR>

docker exec -i manutencao-db psql -U manutencao -d manutencao << 'EOF'
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  user_nome VARCHAR(255),
  user_role VARCHAR(20),
  acao VARCHAR(100) NOT NULL,
  entidade VARCHAR(100),
  entidade_id UUID,
  detalhes JSONB DEFAULT '{}',
  ip VARCHAR(45),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_acao ON audit_logs(acao);
CREATE INDEX IF NOT EXISTS idx_audit_data ON audit_logs(criado_em);

CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT,
  tipo VARCHAR(50) NOT NULL DEFAULT 'info',
  lida BOOLEAN NOT NULL DEFAULT false,
  link VARCHAR(255),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_lida ON notificacoes(user_id, lida);

CREATE TABLE IF NOT EXISTS metricas_uso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  condominio_id UUID REFERENCES condominios(id) ON DELETE CASCADE,
  user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  acao VARCHAR(100) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metricas_cond ON metricas_uso(condominio_id);
CREATE INDEX IF NOT EXISTS idx_metricas_data ON metricas_uso(data);

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  ip VARCHAR(45),
  sucesso BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_email ON login_attempts(email, criado_em);
CREATE INDEX IF NOT EXISTS idx_login_ip ON login_attempts(ip, criado_em);
EOF
```

## Verificação

Após executar, teste o login:

```bash
curl -X POST https://manutencaox.com.br/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"eduardodominikus@hotmail.com","senha":"123456"}'
```

Deve retornar `200` com `{token, user}` ou `401` com "Credenciais inválidas" (se a senha estiver errada).

## Prevenção

As tabelas já foram adicionadas ao `schema.sql` base, então novos deploys (fresh installs) já terão essas tabelas criadas automaticamente.
