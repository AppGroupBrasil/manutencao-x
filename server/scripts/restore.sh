#!/bin/bash
# Restore de backup PostgreSQL gerado pelo backup.sh ou pelo container de backup.
# Uso:
#   BACKUP_FILE=/var/backups/manutencao/manutencao_20260417_030000.sql.gz ./restore.sh

set -euo pipefail

DB_NAME="${PGDATABASE:-manutencao}"
DB_USER="${PGUSER:-manutencao}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
BACKUP_FILE="${BACKUP_FILE:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "ERRO: defina BACKUP_FILE com o caminho do arquivo .sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERRO: arquivo de backup não encontrado: $BACKUP_FILE"
  exit 1
fi

echo "[$(date)] Restaurando backup $BACKUP_FILE em $DB_NAME@$DB_HOST:$DB_PORT"

gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"

echo "[$(date)] Restore concluído com sucesso."
