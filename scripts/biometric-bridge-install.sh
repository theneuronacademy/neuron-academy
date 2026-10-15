#!/usr/bin/env bash
# Biometric bridge installer — free-tier VM (AWS EC2 t2.micro / Oracle Always Free).
# Run ON THE VM, in the same directory you copied adms-bridge.js to.
# You only fill 3 values. Everything else is automatic.
#
#   1) sudo nano /etc/adms-bridge.env   # paste the 3 values (template printed by this script with --template)
#   2) sudo bash biometric-bridge-install.sh
#   3) curl http://localhost:8787/healthz
#
# What it does: installs Node 20 if missing, installs adms-bridge.js to
# /opt/adms-bridge, writes the systemd unit, enables + starts it.
# No repo, no database, no secrets in logs. Secrets live only in /etc/adms-bridge.env (0600).
set -euo pipefail

ENV_FILE="/etc/adms-bridge.env"
APP_DIR="/opt/adms-bridge"

if [[ "${1:-}" == "--template" ]]; then
  cat <<'EOF'
# Paste into /etc/adms-bridge.env (sudo nano /etc/adms-bridge.env), then chmod 600:
NEXT_API_URL=https://YOUR-APP.vercel.app
DEVICE_ID=PASTE-BiometricDevice-id-cuid-HERE
DEVICE_SECRET=PASTE-one-time-secret-HERE
# Optional overrides (defaults are fine):
# PORT=8787
# REQUEST_TIMEOUT_MS=10000
# FORWARD_RETRIES=3
EOF
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash biometric-bridge-install.sh" >&2
  exit 1
fi
if [[ ! -f ./adms-bridge.js ]]; then
  echo "adms-bridge.js not found in current directory. Copy it here first (scp). Aborting." >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE missing. Create it first:" >&2
  echo "  sudo nano $ENV_FILE   # then: sudo bash biometric-bridge-install.sh --template" >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
if [[ -z "${NEXT_API_URL:-}" || -z "${DEVICE_ID:-}" || -z "${DEVICE_SECRET:-}" ]]; then
  echo "NEXT_API_URL, DEVICE_ID and DEVICE_SECRET must all be set in $ENV_FILE. Aborting." >&2
  exit 1
fi
if [[ "$NEXT_API_URL" != https://* ]]; then
  echo "WARNING: NEXT_API_URL should be https:// in production (plain http only for local test)." >&2
fi

if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.versions.node.split('.')[0]) < 20 ? 1 : 0)"; then
  echo "[install] Node 20+ not found — installing..."
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y curl ca-certificates
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
  elif command -v yum >/dev/null 2>&1; then
    yum install -y curl ca-certificates
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y curl ca-certificates
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  else
    echo "No supported package manager (dnf/yum/apt-get). Install Node 20 manually." >&2
    exit 1
  fi
fi
echo "[install] node $(node --version)"

mkdir -p "$APP_DIR"
cp ./adms-bridge.js "$APP_DIR/adms-bridge.js"
chmod 644 "$APP_DIR/adms-bridge.js"
chmod 600 "$ENV_FILE"

cat > /etc/systemd/system/adms-bridge.service <<EOF
[Unit]
Description=Neuron Academy ADMS bridge (K90 -> Next.js)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node $APP_DIR/adms-bridge.js
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now adms-bridge.service
sleep 2
systemctl --no-pager status adms-bridge.service || true
echo "--- health ---"
curl -s http://localhost:8787/healthz; echo
echo "Bridge up. Open TCP 8787 in the cloud security group, then point the K90 Server to this VM's public IP:8787."
