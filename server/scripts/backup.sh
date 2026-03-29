#!/bin/bash
# Backup automático do PostgreSQL
# Rodar via cron: 0 3 * * * /caminho/para/backup.sh >> /var/log/manutencao-backup.log 2>&1

set -euo pipefail

# Configuração
DB_NAME="${PGDATABASE:-manutencao}"
DB_USER="${PGUSER:-manutencao}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/manutencao}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/manutencao_${TIMESTAMP}.sql.gz"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Iniciando backup do banco $DB_NAME..."

# Executar pg_dump
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges --format=plain | gzip > "$BACKUP_FILE"

# Verificar se o backup foi criado
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup concluído com sucesso: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date)] ERRO: Backup falhou ou arquivo vazio"
  exit 1
fi

# Remover backups antigos
DELETED=$(find "$BACKUP_DIR" -name "manutencao_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo "[$(date)] $DELETED backup(s) antigo(s) removido(s) (retenção: ${RETENTION_DAYS} dias)"
