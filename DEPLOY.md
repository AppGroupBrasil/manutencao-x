# Deploy — Manutenção X (Hetzner)

## Deploy Rápido

### 0. Preparar `.env` de produção
Use o template [ .env.production.template ](.env.production.template) como base local e gere o arquivo `.env` que será enviado ao servidor.

```powershell
Copy-Item .env.production.template .env
```

Preencha no mínimo:

```env
DB_PASSWORD=<senha-forte-do-postgres>
JWT_SECRET=<segredo-jwt-forte>
```

Se quiser automatizar o deploy e o smoke test, use os scripts:

```powershell
./scripts/deploy-hetzner.ps1 -ServerIp <SERVER_IP> -SshKey ~/.ssh/<SSH_KEY>
./scripts/smoke-test-hetzner.ps1 -ServerIp <SERVER_IP> -SshKey ~/.ssh/<SSH_KEY>
```

### 1. Upload dos arquivos alterados
```powershell
# Da máquina local (PowerShell):
scp -i ~/.ssh/<SSH_KEY> -r <LOCAL_PATH>/src root@<SERVER_IP>:/opt/manutencao-app/
scp -i ~/.ssh/<SSH_KEY> -r <LOCAL_PATH>/server root@<SERVER_IP>:/opt/manutencao-app/
scp -i ~/.ssh/<SSH_KEY> -r <LOCAL_PATH>/public root@<SERVER_IP>:/opt/manutencao-app/
scp -i ~/.ssh/<SSH_KEY> <LOCAL_PATH>/index.html <LOCAL_PATH>/package.json <LOCAL_PATH>/package-lock.json <LOCAL_PATH>/.env root@<SERVER_IP>:/opt/manutencao-app/
```

### 2. Rebuild e restart no servidor
```powershell
ssh -i ~/.ssh/<SSH_KEY> root@<SERVER_IP> "cd /opt/manutencao-app && docker compose down && docker compose build --no-cache && docker compose up -d"
```

### Variáveis obrigatórias no `.env` do servidor
```env
DB_PASSWORD=<senha-forte-do-postgres>
JWT_SECRET=<segredo-jwt-forte>
```

### Variáveis opcionais recomendadas
Use estas se quiser habilitar recuperação de senha por e-mail e push notifications web:

```env
MASTER_EMAIL=<email-master-inicial>
MASTER_PASSWORD=<senha-forte-inicial>
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-pass>
SMTP_FROM=Manutenção X <noreply@manutencaox.com.br>
VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
VAPID_EMAIL=mailto:admin@manutencaox.com.br
```

### 3. Conferir se está rodando
```powershell
ssh -i ~/.ssh/<SSH_KEY> root@<SERVER_IP> "docker ps --filter name=manutencao-app --format 'table {{.Names}}\t{{.Status}}'"
```

### 4. Smoke tests pós-deploy
```powershell
# Health check da API
ssh -i ~/.ssh/<SSH_KEY> root@<SERVER_IP> "curl -I https://manutencaox.com.br/api/health"

# Conferir logs iniciais do backend
ssh -i ~/.ssh/<SSH_KEY> root@<SERVER_IP> "docker logs --tail 80 manutencao-api"

# Conferir logs iniciais do frontend
ssh -i ~/.ssh/<SSH_KEY> root@<SERVER_IP> "docker logs --tail 40 manutencao-app"
```

## Checklist Final

- `npm run build` na raiz OK
- `npm run build` em `server/` OK
- `.env` do servidor preenchido com `DB_PASSWORD` e `JWT_SECRET`
- `FRONTEND_URL` apontando para `https://manutencaox.com.br` via compose
- rede Docker `coolify` existente no servidor
- DNS de `manutencaox.com.br` e `www` apontando para o servidor
- porta 80/443 liberadas no host
- banco inicializado com schema
- usuário master criado com senha temporária forte, depois alterada no primeiro login
- `/api/health` respondendo `200`
- login web validado manualmente
- upload de arquivo validado manualmente
- WebSocket validado ao abrir dashboard com sessão autenticada

## Riscos Conhecidos

- Sem `SMTP_*`, a recuperação de senha não envia e-mail real; o backend apenas registra no log.
- Sem `VAPID_*`, notificações push ficam desabilitadas; isso não impede o sistema principal de operar.
- O build do frontend passa, mas há bundles grandes; é risco de performance, não de disponibilidade.
- A CSP atual permite `'unsafe-inline'` para script e style em [nginx.conf](nginx.conf#L74); aceitável para o estado atual, mas não é o endurecimento máximo.

---

## Estrutura no Servidor

| Item | Caminho |
|------|---------|
| Projeto | `/opt/manutencao-app/` |
| Dockerfile | `/opt/manutencao-app/Dockerfile` |
| docker-compose | `/opt/manutencao-app/docker-compose.yml` |
| Nginx config | `/opt/manutencao-app/nginx.conf` |
| Código fonte | `/opt/manutencao-app/src/` |
| Assets | `/opt/manutencao-app/public/` |
| Variáveis | `/opt/manutencao-app/.env` |

## Dados Importantes

- **Servidor:** `<SERVER_IP>` (Hetzner, Ubuntu 22.04, 2 vCPU, 4GB RAM)
- **SSH:** `ssh -i ~/.ssh/<SSH_KEY> root@<SERVER_IP>`
- **Container:** `manutencao-app` (nginx:alpine)
- **Rede Docker:** `coolify` (compartilhada com Traefik)
- **Domínio:** `manutencaox.com.br` (HTTPS via Traefik/LetsEncrypt)
- **Cloudflare NS:** `audrey.ns.cloudflare.com` / `weston.ns.cloudflare.com`

## Cenários de Atualização

### Mudou schema do banco (migrações)
Executar migrações ANTES do deploy:
```powershell
# Copiar arquivo de migração
scp -i ~/.ssh/<SSH_KEY> <LOCAL_PATH>/server/src/db/migrations/<MIGRATION_FILE>.sql root@<SERVER_IP>:/tmp/

# Executar no container do banco
ssh -i ~/.ssh/<SSH_KEY> root@<SERVER_IP> "docker exec -i manutencao-db psql -U manutencao -d manutencao < /tmp/<MIGRATION_FILE>.sql"
```

### Mudou só código (CSS/TSX, sem novas dependências)
Mesmo processo — passos 1, 2 e 3 acima.

### Adicionou novas dependências (npm install)
Atualizar o `package-lock.json` local e incluir no upload do passo 1.

### Mudou Dockerfile, nginx.conf ou docker-compose.yml
```powershell
scp -i ~/.ssh/<SSH_KEY> <LOCAL_PATH>/Dockerfile <LOCAL_PATH>/docker-compose.yml <LOCAL_PATH>/nginx.conf root@<SERVER_IP>:/opt/manutencao-app/
```
Depois rebuild normalmente (passo 2).

## Outros Apps no Mesmo Servidor

| App | Domínio | Porta | Diretório |
|-----|---------|-------|-----------|
| app-correspondencia | appcorrespondencia.com.br | 3000 | /opt/app-correspondencia/ |
| portariax | portariax.com.br | 3001 | /opt/portariax/ |
| app-sindico | appsindico.com.br | 3000 | /opt/app-sindico/ |
| app-obras | appobras.com.br | 8080 | — |
| manutencao | manutencaox.com.br | 80 | /root/manutencao/ |
| app-reserva | appreserva.com.br | 3000 | /opt/app-reserva/ |


