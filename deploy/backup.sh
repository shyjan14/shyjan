#!/bin/sh
# Daily backup of the database and uploaded files. Keeps 30 days.
# Install on the server (runs at 02:30 every night):
#   chmod +x deploy/backup.sh
#   (crontab -l 2>/dev/null; echo "30 2 * * * cd $HOME/shyjan && ./deploy/backup.sh >> $HOME/backup.log 2>&1") | crontab -
# Copy the backups folder off the server as well (Azure Blob / S3 / Google Drive).
set -eu
DIR="${BACKUP_DIR:-$HOME/hr-backups}"
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DIR"
docker compose exec -T db pg_dump -U hrms -Fc hrms > "$DIR/db_$STAMP.dump"
docker compose exec -T api tar czf - -C /app uploads > "$DIR/uploads_$STAMP.tar.gz"
find "$DIR" -type f -mtime +30 -delete
echo "$(date) backup ok: $DIR/db_$STAMP.dump"
