#!/usr/bin/env bash
# First-time VPS setup when Nginx/SSL is managed by Webinoly.
# Does not apt-install nginx/certbot, does not overwrite /etc/nginx/sites-available.
#
# Usage (as root, from a release tree already extracted at APP_DIR):
#   sudo bash scripts/setup-vps-webinoly.sh
#   sudo SKIP_SSL=1 bash scripts/setup-vps-webinoly.sh   # DNS not ready yet
#   sudo SKIP_SITE=1 bash scripts/setup-vps-webinoly.sh  # Node + systemd only
# App code: GitHub Actions build artifact → SCP → deploy.sh --release
# (no git clone / npm build on the VPS).
set -euo pipefail

DOMAIN="${DOMAIN:-traffic.codayroi.com}"
APP_USER="${APP_USER:-traffichcm}"
PORT="${PORT:-8790}"
SKIP_SITE="${SKIP_SITE:-0}"
SKIP_SSL="${SKIP_SSL:-0}"

webinoly_create_proxy() {
  local domain="$1"
  local port="$2"
  local attempt
  for attempt in \
    "-proxy=[127.0.0.1:${port}]" \
    "-proxy=[http://127.0.0.1:${port}]" \
    "-proxy=[localhost:${port}]" \
    "-proxy=[http://localhost:${port}]"
  do
    echo "==> Try: site ${domain} ${attempt}"
    # shellcheck disable=SC2086
    if site "${domain}" ${attempt}; then
      echo "==> Proxy OK (${attempt})"
      return 0
    fi
  done
  return 1
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/setup-vps-webinoly.sh" >&2
  exit 1
fi

if ! command -v site >/dev/null 2>&1; then
  echo "Webinoly \`site\` command not found. Install Webinoly first, then re-run." >&2
  echo "  https://webinoly.com/" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SITE_NGINX="/etc/nginx/sites-available/${DOMAIN}"

echo "==> App dir: ${APP_DIR}"
echo "==> Domain: ${DOMAIN}"
echo "==> Proxy: 127.0.0.1:${PORT} (Webinoly; do not edit nginx conf by hand)"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y --allow-releaseinfo-change
apt-get install -y curl ca-certificates

if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) < 20)'; then
  echo "==> Install Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "==> Node $(node -v)"

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  adduser --system --group --home "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

UNIT_TMP="$(mktemp)"
sed "s|__APP_DIR__|${APP_DIR}|g" "${APP_DIR}/deploy/traffichcm.service" > "${UNIT_TMP}"
install -m 644 "${UNIT_TMP}" /etc/systemd/system/traffichcm.service
rm -f "${UNIT_TMP}"
systemctl daemon-reload
systemctl enable traffichcm

if [[ -d "${APP_DIR}/.next" && -x "${APP_DIR}/node_modules/.bin/next" ]]; then
  echo "==> Restart from existing artifact (no npm build on VPS)"
  bash "${APP_DIR}/scripts/deploy.sh"
else
  echo "==> No release artifact in ${APP_DIR} yet."
  echo "    Push main / Run workflow — CI builds + SCPs tarball, then deploy.sh --release."
fi

if [[ "${SKIP_SITE}" != "1" ]]; then
  if [[ -e "${SITE_NGINX}" ]]; then
    echo "==> Site ${DOMAIN} already exists (Webinoly). Not recreating."
    site "${DOMAIN}" -info || true
  else
    echo "==> Create Webinoly reverse proxy → app port ${PORT}"
    if ! webinoly_create_proxy "${DOMAIN}" "${PORT}"; then
      echo "Warning: proxy site creation failed — app can still run on :${PORT}." >&2
      echo "Try manually:" >&2
      echo "  sudo site ${DOMAIN} -proxy=[127.0.0.1:${PORT}]" >&2
      echo "  sudo site ${DOMAIN} -ssl=on" >&2
    fi
  fi

  if [[ "${SKIP_SSL}" != "1" && -e "${SITE_NGINX}" ]]; then
    echo "==> SSL Let's Encrypt (Webinoly)"
    if site "${DOMAIN}" -ssl=on; then
      echo "==> SSL OK"
    else
      echo "SSL not ready. Check DNS A ${DOMAIN} → VPS IP, then:" >&2
      echo "  sudo site ${DOMAIN} -ssl=on" >&2
    fi
  elif [[ "${SKIP_SSL}" == "1" ]]; then
    echo "==> Skip SSL (SKIP_SSL=1). When DNS is ready:"
    echo "    sudo site ${DOMAIN} -ssl=on"
  fi
else
  echo "==> Skip Webinoly site (SKIP_SITE=1). Create manually:"
  echo "    sudo site ${DOMAIN} -proxy=[127.0.0.1:${PORT}]"
  echo "    sudo site ${DOMAIN} -ssl=on"
fi

echo
echo "==> Webinoly setup done."
echo "    Local:  curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:${PORT}/"
echo "    Public: https://${DOMAIN}/"
echo "    Log:    journalctl -u traffichcm -f"
echo "    Deploy: GitHub Actions SCP → sudo bash scripts/deploy.sh --release /tmp/traffichcm-release.tar.gz"
