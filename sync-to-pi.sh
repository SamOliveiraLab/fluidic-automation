#!/usr/bin/env bash
# Sync this project to the Pioreactor. Usage:
#   ./sync-to-pi.sh              # sync, then ask to restart
#   ./sync-to-pi.sh -r           # sync and restart automatically
#   ./sync-to-pi.sh pioreactor@oliveirapioreactor01.local
#   ./sync-to-pi.sh -r pioreactor@192.168.8.227

set -e
RESTART=""
DEST="pioreactor@oliveirapioreactor01.local"

for arg in "$@"; do
  if [[ "$arg" == "-r" ]]; then
    RESTART=1
  elif [[ "$arg" != -* ]]; then
    DEST="$arg"
  fi
done

REMOTE_DIR="/home/pioreactor/fluidic-automation"

# Always remove macOS junk before syncing
find . -name '._*' -delete 2>/dev/null || true
find . -name '.DS_Store' -delete 2>/dev/null || true

echo "Syncing to $DEST:$REMOTE_DIR ..."

rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude '._*' \
  --exclude '.DS_Store' \
  --exclude '*.log' \
  . "$DEST:$REMOTE_DIR/"

echo "Done."
if [[ -n "$RESTART" ]]; then
  ssh "$DEST" "sudo systemctl restart fluidic-dashboard"
  echo "Dashboard restarted."
else
  read -r -p "Restart fluidic-dashboard? (y/n) " ans
  if [[ "$ans" =~ ^[yY] ]]; then
    ssh "$DEST" "sudo systemctl restart fluidic-dashboard"
    echo "Dashboard restarted."
  fi
fi
