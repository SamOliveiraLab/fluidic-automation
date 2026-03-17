#!/usr/bin/env bash
# ==============================================================
# Pioreactor ngrok tunnel setup script
# Run this ON your Pioreactor (Raspberry Pi) to expose it
# at a permanent URL: https://isopiestic-uneradicative-breana.ngrok-free.dev
# ==============================================================

set -e

NGROK_DOMAIN="isopiestic-uneradicative-breana.ngrok-free.dev"
PIOREACTOR_PORT=80
AUTHTOKEN="36jnG5ARoicCmBauledXMhvnaFI_3GhrdTdCXKdbhmTFDpUKX"

echo "=== Pioreactor ngrok tunnel setup ==="

# 1. Install ngrok if not present
if ! command -v ngrok &>/dev/null; then
  echo "[1/3] Installing ngrok..."
  curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
    | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
  echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
    | sudo tee /etc/apt/sources.list.d/ngrok.list
  sudo apt update && sudo apt install -y ngrok
else
  echo "[1/3] ngrok already installed: $(ngrok version)"
fi

# 2. Set auth token
echo "[2/3] Configuring ngrok auth token..."
ngrok config add-authtoken "$AUTHTOKEN"

# 3. Start the tunnel
echo "[3/3] Starting tunnel → http://localhost:${PIOREACTOR_PORT}"
echo "       Public URL: https://${NGROK_DOMAIN}"
echo ""
echo "Press Ctrl+C to stop the tunnel."
echo ""
ngrok http "$PIOREACTOR_PORT" --domain="$NGROK_DOMAIN"
