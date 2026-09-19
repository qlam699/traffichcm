#!/usr/bin/env bash
# Apply release artifact on the VPS: wipe APP_DIR, extract, write env, restart systemd.
# Runtime env: GitHub Actions secrets/vars → /etc/traffichcm.env (no .env in repo on VPS).
# Usage:
#   sudo APP_DIR=/var/www/traffichcm bash scripts/deploy.sh --release /tmp/traffichcm-release.tar.gz
#   sudo bash scripts/deploy.sh   # rewrite env (if set) + restart when release already present
set -euo pipefail

APP_USER="${APP_USER:-traffichcm}"
RUNTIME_ENV="${RUNTIME_ENV:-/etc/traffichcm.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_TAR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release)
      RELEASE_TAR="${2:?--release needs tarball path}"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--release /path/to/traffichcm-release.tar.gz]" >&2
      exit 1
      ;;
  esac
done

if [[ -n "${RELEASE_TAR}" ]]; then
  APP_DIR="${APP_DIR:-/var/www/traffichcm}"
else
  APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
fi

write_runtime_env() {
  umask 077
  {
    printf 'PORT=%s\n' "${PORT:-8790}"
    printf 'TRAFFIC_CAMERA_PROVIDER=%s\n' "${TRAFFIC_CAMERA_PROVIDER:-hcmc}"
    printf 'TRAFFIC_CAMERA_BASE_URL=%s\n' \
      "${TRAFFIC_CAMERA_BASE_URL:-https://abc.com}"
    printf 'NEXT_PUBLIC_MAP_TILE_URL=%s\n' "${NEXT_PUBLIC_MAP_TILE_URL:-}"
    printf 'NEXT_PUBLIC_MAP_ATTRIBUTION=%s\n' "${NEXT_PUBLIC_MAP_ATTRIBUTION:-}"
    printf 'UPSTREAM_REQUEST_TIMEOUT_MS=%s\n' "${UPSTREAM_REQUEST_TIMEOUT_MS:-10000}"
    printf 'CAMERA_METADATA_CACHE_TTL_SECONDS=%s\n' "${CAMERA_METADATA_CACHE_TTL_SECONDS:-60}"
  } > "${RUNTIME_ENV}"
  chmod 600 "${RUNTIME_ENV}"
}

app_port() {
  if [[ -f "${RUNTIME_ENV}" ]]; then
    local p
    p="$(grep -E '^PORT=' "${RUNTIME_ENV}" | head -1 | cut -d= -f2- || true)"
    if [[ -n "${p}" ]]; then
      echo "${p}"
      return
    fi
  fi
  echo "${PORT:-8790}"
}

install_unit() {
  local unit_src="${APP_DIR}/deploy/traffichcm.service"
  if [[ ! -f "${unit_src}" ]]; then
    echo "Missing ${unit_src}" >&2
    return 1
  fi
  local unit_tmp
  unit_tmp="$(mktemp)"
  sed "s|__APP_DIR__|${APP_DIR}|g" "${unit_src}" > "${unit_tmp}"
  install -m 644 "${unit_tmp}" /etc/systemd/system/traffichcm.service
  rm -f "${unit_tmp}"
  systemctl daemon-reload
  systemctl enable traffichcm
}

restart_service() {
  if [[ ! -f /etc/systemd/system/traffichcm.service ]]; then
    echo "==> No systemd unit yet — run: sudo bash scripts/setup-vps-webinoly.sh" >&2
    return 1
  fi
  echo "==> systemctl restart traffichcm"
  systemctl daemon-reload
  systemctl restart traffichcm
  systemctl --no-pager --full status traffichcm || true
}

apply_release() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Need root for --release (wipe ${APP_DIR})." >&2
    exit 1
  fi
  if [[ ! -f "${RELEASE_TAR}" ]]; then
    echo "Tarball not found: ${RELEASE_TAR}" >&2
    exit 1
  fi

  if [[ -f /etc/systemd/system/traffichcm.service ]]; then
    echo "==> systemctl stop traffichcm"
    systemctl stop traffichcm || true
  fi

  echo "==> Wipe ${APP_DIR}"
  rm -rf "${APP_DIR}"
  mkdir -p "${APP_DIR}"
  echo "==> Extract ${RELEASE_TAR} → ${APP_DIR}"
  tar -xzf "${RELEASE_TAR}" -C "${APP_DIR}"

  if id -u "${APP_USER}" >/dev/null 2>&1; then
    chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
  fi

  echo "==> Install / update systemd unit"
  install_unit
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/deploy.sh ..." >&2
  exit 1
fi

if [[ -n "${RELEASE_TAR}" ]]; then
  apply_release
fi

write_runtime_env
echo "==> Wrote ${RUNTIME_ENV}"

if [[ ! -d "${APP_DIR}/.next" || ! -x "${APP_DIR}/node_modules/.bin/next" ]]; then
  echo "Missing Next.js build in ${APP_DIR} — deploy via GitHub Actions --release artifact." >&2
  exit 1
fi

restart_service

PORT_CHECK="$(app_port)"
echo "==> health"
sleep 2
curl -fsS -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:${PORT_CHECK}/" || {
  echo "Health check failed. See: journalctl -u traffichcm -n 80 --no-pager" >&2
  exit 1
}
echo "==> Deploy done: https://traffic.codayroi.com"
