#!/bin/bash
# ==============================================================================
# JH Hogar / JhosuaComercial — Deploy Swarm (Renace VPS)
# VPS: /opt/jhosuacom
#
# IMPORTANTE: NO usar `docker compose config` para stack deploy.
# Compose convierte cpus: "0.50" → 0.5 (float) y Swarm falla con:
#   services.*.deploy.resources.limits.cpus must be a string
# ==============================================================================
set -euo pipefail

STACK="jhosuacom"
BRANCH="${DEPLOY_BRANCH:-feat/jh-hogar-mvp}"

PROJECT_DIR=""
for dir in /opt/jhosuacom /opt/jhosuacomercial; do
  if [ -d "$dir" ] && [ -f "$dir/docker-compose.yml" ]; then
    PROJECT_DIR="$dir"
    break
  fi
done

if [ -z "$PROJECT_DIR" ] && [ -f "./docker-compose.yml" ]; then
  PROJECT_DIR="$(pwd)"
fi

if [ -z "$PROJECT_DIR" ]; then
  echo "❌ No se encontró jhosuacom (esperado: /opt/jhosuacom)"
  exit 1
fi

cd "$PROJECT_DIR"

echo "-----------------------------------"
echo "🛰️  JH Hogar deploy"
echo "    dir=$PROJECT_DIR stack=$STACK branch=$BRANCH"
echo "-----------------------------------"

echo "💾 Disco..."
df -h / | tail -1
docker system df || true

echo "📥 Sync Git..."
git fetch --all
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "🔐 Environment..."
if [ ! -f .env ]; then
  DB_PASS="$(openssl rand -hex 16)"
  JWT="$(openssl rand -hex 24)"
  cat > .env <<EOF
DB_USER=jhosua
DB_PASSWORD=${DB_PASS}
DB_NAME=jhosua
DATABASE_URL=postgres://jhosua:${DB_PASS}@jhosua-db:5432/jhosua
JWT_SECRET=${JWT}
ADMIN_EMAIL=admin@jhhogar.com
ADMIN_PASSWORD=JhHogarAdmin2026!
NEXT_PUBLIC_API_URL=https://jhosuacomercial.com/api
PUBLIC_WEB_URL=https://jhosuacomercial.com
ODOO_MOCK=true
ODOO_URL=
ODOO_DB=
ODOO_USERNAME=
ODOO_API_KEY=
ODOO_COMPANY_IDS=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=jhhogar
ADMIN_NOTIFY_PHONES=
RUN_DB_PUSH=true
RUN_DB_SEED=true
EOF
  echo "✅ .env creado"
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

# Forzar API en mismo dominio (evita Failed to fetch por DNS api.*)
if grep -q 'api.jhosuacomercial.com' .env 2>/dev/null; then
  sed -i 's|https://api.jhosuacomercial.com/api|https://jhosuacomercial.com/api|g' .env
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  echo "ℹ️  NEXT_PUBLIC_API_URL → https://jhosuacomercial.com/api"
fi

echo "🌐 RenaceNet..."
if ! docker network inspect RenaceNet >/dev/null 2>&1; then
  docker network create --driver overlay --attachable RenaceNet
else
  echo "ℹ️  RenaceNet ok"
fi

echo "🏗️  Build images..."
docker compose build --parallel

echo "🚢 Stack deploy (yaml directo, sin compose config)..."
docker stack deploy -c docker-compose.yml "$STACK"

echo "⏳ Esperando API (hasta 90s)..."
for i in $(seq 1 18); do
  if docker service ls --format '{{.Name}} {{.Replicas}}' | grep -q 'jhosuacom_api 1/1'; then
    echo "✅ API 1/1"
    break
  fi
  sleep 5
done

echo "-----------------------------------"
echo "✅ Deploy OK"
echo "   Web:   https://jhosuacomercial.com"
echo "   API:   https://jhosuacomercial.com/api/health"
echo "   Admin: https://jhosuacomercial.com/admin/login"
echo "   User:  admin@jhhogar.com  (ver ADMIN_PASSWORD en .env)"
echo "-----------------------------------"
docker stack services "$STACK"
docker service ps jhosuacom_api --no-trunc | head -8 || true

