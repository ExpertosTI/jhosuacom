#!/usr/bin/env bash
# JH Hogar — sync Evolution (clave global Renace) → VPS, sin pegar credenciales
# Uso (desde Mac):
#   ./scripts/push-evo.sh
#   ./scripts/push-evo.sh --no-deploy
#   VPS=root@45.9.191.18 REMOTE_DIR=/opt/jhosuacom ./scripts/push-evo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VPS="${VPS:-root@45.9.191.18}"
REMOTE_DIR="${REMOTE_DIR:-/opt/jhosuacom}"
LOCAL_EVO="$ROOT/.evolution.local"
RNV_EVO="${RNV_EVO:-/Users/brainiacx/APPS/rnv-manger/.evolution.local}"
ZAV_EVO="${ZAV_EVO:-/Users/brainiacx/APPS/ZAV/.evolution.local}"
DO_DEPLOY=1

for arg in "$@"; do
  case "$arg" in
    --no-deploy) DO_DEPLOY=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

cyan()  { printf "\033[36m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*" >&2; }

cd "$ROOT"

pick_source() {
  if [ -f "$LOCAL_EVO" ] && grep -q '^EVOLUTION_API_KEY=.\+' "$LOCAL_EVO"; then
    echo "$LOCAL_EVO"
    return
  fi
  if [ -f "$RNV_EVO" ] && grep -q '^EVOLUTION_API_KEY=.\+' "$RNV_EVO"; then
    echo "$RNV_EVO"
    return
  fi
  if [ -f "$ZAV_EVO" ] && grep -q '^EVOLUTION_API_KEY=.\+' "$ZAV_EVO"; then
    echo "$ZAV_EVO"
    return
  fi
  return 1
}

SRC="$(pick_source)" || {
  red "No hay EVOLUTION_API_KEY en .evolution.local / rnv-manger / ZAV"
  exit 1
}

cyan "── Evolution source: $SRC ──"
python3 - "$SRC" "$LOCAL_EVO" <<'PY'
import sys
from pathlib import Path

src, dest = Path(sys.argv[1]), Path(sys.argv[2])
kv = {}
for line in src.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    kv[k.strip()] = v.strip().strip('"').strip("'")

if not kv.get("EVOLUTION_API_KEY"):
    raise SystemExit("EVOLUTION_API_KEY vacío en source")

out = "\n".join([
    "# Evolution API — global AUTHENTICATION_API_KEY (Renace evoapi)",
    "# Generado por scripts/push-evo.sh — no commitear",
    "",
    f"EVOLUTION_API_URL={kv.get('EVOLUTION_API_URL') or 'https://evoapi.renace.tech'}",
    f"EVOLUTION_API_KEY={kv['EVOLUTION_API_KEY']}",
    "EVOLUTION_INSTANCE=jhhogar",
    "",
])
dest.write_text(out)
print(f"wrote {dest} (instance=jhhogar, key len={len(kv['EVOLUTION_API_KEY'])})")
PY

cyan "── Upload → $VPS:$REMOTE_DIR/.evolution.local ──"
scp -o StrictHostKeyChecking=accept-new "$LOCAL_EVO" "$VPS:$REMOTE_DIR/.evolution.local"

cyan "── Remote seed${DO_DEPLOY:+ + stack env} ──"
ssh -o StrictHostKeyChecking=accept-new "$VPS" bash -s -- "$REMOTE_DIR" "$DO_DEPLOY" <<'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"
DO_DEPLOY="$2"
cd "$REMOTE_DIR"

force_env() {
  local key="$1" val="$2" file="${3:-.env}"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$file"
  else
    echo "${key}=${val}" >> "$file"
  fi
}

if [ ! -f .env ]; then
  echo "❌ Falta .env — corre ./deploy.sh primero"
  exit 1
fi

if [ -f .evolution.local ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    line="$(echo "$line" | tr -d '\r')"
    [ -z "$line" ] && continue
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      EVOLUTION_API_URL|EVOLUTION_API_KEY|EVOLUTION_INSTANCE)
        force_env "$key" "$val"
        ;;
    esac
  done < .evolution.local
fi

force_env EVOLUTION_INSTANCE "jhhogar"
grep -q '^EVOLUTION_API_URL=.\+' .env || force_env EVOLUTION_API_URL "https://evoapi.renace.tech"

echo "── Evolution on server ──"
grep -E '^EVOLUTION_(API_URL|INSTANCE)=' .env || true
test -n "$(grep '^EVOLUTION_API_KEY=' .env | cut -d= -f2-)" && echo "EVOLUTION_API_KEY: set" || echo "EVOLUTION_API_KEY: MISSING"

if [ "$DO_DEPLOY" = "1" ]; then
  # Re-aplicar stack para que Swarm tome env del .env (compose)
  docker stack deploy -c docker-compose.yml jhosuacom
  docker service update --force --no-healthcheck jhosuacom_api 2>/dev/null || true
fi
REMOTE

green "✅ Evolution listo → instancia jhhogar"
green "   Admin: https://jhosuacomercial.com/admin/whatsapp  (solo QR)"
