# Backend Setup: Pioreactor API at api.environnets.com

Expose your Pioreactor (port 80) at a stable URL using Cloudflare Tunnel.

## Prerequisites

1. **environnets.com in Cloudflare**
   - Add site at [dash.cloudflare.com](https://dash.cloudflare.com)
   - Update nameservers at GoDaddy to Cloudflare's (wait 5–30 min for propagation)

2. **cloudflared on the Pi**
   - Already installed if you used Cloudflare before
   - If not: `curl -L -o cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb` then `sudo dpkg -i cloudflared.deb`

---

## Step 1: Login and create tunnel

**Best: run on the Pi** (SSH in first) so credentials stay there:

```bash
ssh pioreactor@oliveirapioreactor01.local
cloudflared tunnel login
```
- Opens browser → select **environnets.com** → authorize  
- If on Pi without a browser, copy the URL shown and open it on your Mac

```bash
cloudflared tunnel create pioreactor-api
```
- Saves credentials to `~/.cloudflared/<TUNNEL_ID>.json` on the Pi
- **Copy the TUNNEL_ID** from the output (looks like `abc123-def456-...`)

---

## Step 2: Configure on the Pi

SSH to the Pi:

```bash
ssh pioreactor@oliveirapioreactor01.local
```

Create config directory and edit config:

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Paste this (replace `YOUR_TUNNEL_ID` with the actual ID):

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/pioreactor/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: api.environnets.com
    service: http://localhost:80
  - service: http_status:404
```

Save (Ctrl+O, Enter, Ctrl+X).

*(If you ran `tunnel create` on your Mac, copy credentials: `scp ~/.cloudflared/YOUR_TUNNEL_ID.json pioreactor@oliveirapioreactor01.local:~/.cloudflared/`)*

---

## Step 3: Create DNS route

On the Pi (or any machine with cloudflared logged in):

```bash
cloudflared tunnel route dns pioreactor-api api.environnets.com
```

This creates the CNAME record in Cloudflare.

---

## Step 4: Install and start the service

Copy the service file to the Pi (from your Mac):

```bash
scp cloudflared-pioreactor.service pioreactor@oliveirapioreactor01.local:~
```

On the Pi:

```bash
sudo cp ~/cloudflared-pioreactor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-pioreactor
sudo systemctl start cloudflared-pioreactor
sudo systemctl status cloudflared-pioreactor
```

---

## Step 5: Test

Open in browser: **https://api.environnets.com**

You should see the Pioreactor UI/API. Test an endpoint:
**https://api.environnets.com/api/workers**

---

## Once it works

- You can disable ngrok if you no longer need it: `sudo systemctl stop ngrok-pioreactor && sudo systemctl disable ngrok-pioreactor`
- Your backend is now at **https://api.environnets.com** (stable, no interstitial)
