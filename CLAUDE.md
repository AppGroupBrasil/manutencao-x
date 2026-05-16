# CLAUDE.md — Manutenção X

Guia rápido para o Claude operar este projeto em sessões futuras. Para info completa, ver `c:\Users\HP\OneDrive\Área de Trabalho\DOCUMENTAÇÃO\Documentação Manutenção X\INFO.md`. Para credenciais, `CREDENCIAIS.md` na mesma pasta.

## Stack
- Frontend: React 18 + Vite + TS, PWA, Capacitor, `src/`
- Backend: Express 4 + TS + Postgres 16, `server/`
- Deploy: GitHub Actions → SSH Hetzner → docker compose

## Comandos
```powershell
npm run dev:all              # roda frontend (3003) + backend (3001)
npm run typecheck            # frontend type-check
cd server; npm run typecheck # backend
cd server; npm run migrate   # aplicar migrações (CLI)
npm run build                # produção
```

## Onde encontrar
- Rotas REST: `server/src/routes/*.ts` (47 arquivos, uma feature por arquivo)
- Middlewares: `server/src/middleware/` (auth, rbac, validation Zod, helpers rate-limit)
- DB: `server/src/db/migrations/*.sql` ordenadas, aplicadas automaticamente no boot via `migrate.ts`
- Services: `server/src/services/` (email, sentry opcional, refreshToken)
- Páginas: `src/pages/<Feature>/` — uma pasta por feature
- Componentes comuns: `src/components/Common/`
- Cliente API: `src/services/api.ts`

## Auth (importante)
- JWT 24h (`JWT_EXPIRES_IN`) + refresh token 7d com rotação obrigatória.
- Rotas: `POST /api/auth/login` retorna `{token, refreshToken, user}`. `POST /api/auth/refresh` rotaciona. `POST /api/auth/logout` revoga todos os refresh.
- Roles: `master` > `administrador` > `supervisor` > `funcionario`.
- Frontend hoje só usa `token` — refresh está implementado no server mas cliente ainda não consome.

## Padrões de código
- Sem comentários explicativos (regra global).
- Edits mínimos, sem refactors paralelos.
- Zod para validação de input em todas as rotas (`middleware/validation.ts` tem os schemas).
- Erros centralizados no global error handler em `index.ts` (FK violation 23503→409, unique 23505→409, ECONNREFUSED→503).
- Request-id em `X-Request-Id` header (in/out) + log de erros + resposta JSON com `requestId`.

## Antes de mexer em rota
1. Conferir se já existe schema Zod em `middleware/validation.ts`.
2. Conferir RBAC necessário (escopo de condomínio via `scopeMiddleware`).
3. Validar com `npm run typecheck` em ambos lados.

## Hardening aplicado (2026-05-16)
- JWT_SECRET obrigatório (>=32 chars), boot falha sem ele.
- SSL Postgres com `rejectUnauthorized` opcional via `DB_SSL_STRICT`.
- Auto-migrator no startup (tabela `schema_migrations`).
- Senha mínima 8 chars.
- Rate-limit configurável (`RATE_LIMIT_ENABLED`).
- xlsx → exceljs.
- Sentry opcional via `SENTRY_DSN`.

## Não fazer
- Não commitar `.env` (gitignored, já protegido).
- Não usar `unsafe-inline` em scripts novos (CSP já tem em `nginx.conf:80`, mas migrar para nonce é meta).
- Não rodar `npm install` no servidor — sempre via rebuild docker.
- Não tocar em `/opt/manutencaox/` (lixo) — o app real é `/opt/manutencao-app/`.

## Deploy
Push em `main` aciona GH Actions. Watch:
```powershell
gh run watch --repo AppGroupBrasil/manutencao-x
```

Migrações aplicam sozinhas no boot do container — não precisa rodar manualmente em prod.
