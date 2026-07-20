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
# Liberar espacio antes del build (VPS ~48G; builds dejan capas huérfanas)
echo "🧹 Prune Docker (imágenes/caché no usadas)..."
docker container prune -f >/dev/null 2>&1 || true
docker image prune -af >/dev/null 2>&1 || true
docker builder prune -af >/dev/null 2>&1 || true
df -h / | tail -1

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
NEXT_PUBLIC_API_URL=/api
PUBLIC_WEB_URL=https://jhosuacomercial.com
INTERNAL_API_URL=http://jhosuacom_api:3000
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
RUN_DB_PUSH=false
RUN_DB_SEED=false
EOF
  echo "✅ .env creado"
fi

# Evitar OOM: .env viejo podía tener RUN_DB_*=true en cada arranque
grep -q '^RUN_DB_PUSH=' .env \
  && sed -i 's|^RUN_DB_PUSH=.*|RUN_DB_PUSH=false|' .env \
  || echo 'RUN_DB_PUSH=false' >> .env
grep -q '^RUN_DB_SEED=' .env \
  && sed -i 's|^RUN_DB_SEED=.*|RUN_DB_SEED=false|' .env \
  || echo 'RUN_DB_SEED=false' >> .env

set -a
# shellcheck disable=SC1091
. ./.env
set +a

# Forzar API relativa (proxy Next → Nest en Swarm)
if ! grep -q '^NEXT_PUBLIC_API_URL=/api$' .env 2>/dev/null; then
  grep -q '^NEXT_PUBLIC_API_URL=' .env \
    && sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=/api|' .env \
    || echo 'NEXT_PUBLIC_API_URL=/api' >> .env
  grep -q '^INTERNAL_API_URL=' .env \
    || echo 'INTERNAL_API_URL=http://jhosuacom_api:3000' >> .env
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  echo "ℹ️  API vía proxy: NEXT_PUBLIC_API_URL=/api → jhosuacom_api"
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

# Quitar routers Traefik viejos del API (PathPrefix) si quedaron
docker service update --label-rm traefik.enable \
  --label-rm traefik.http.routers.jhosua-api.rule \
  --label-rm traefik.http.routers.jhosua-api-http.rule \
  "${STACK}_api" 2>/dev/null || true

echo "🔄 Force update (nueva imagen)..."
docker service update --force --image jhosuacom-api:latest "${STACK}_api" || true
docker service update --force --image jhosuacom-web:latest "${STACK}_web" || true

echo "⏳ Esperando API 1/1 (hasta 120s)..."
for i in $(seq 1 24); do
  if docker service ls --format '{{.Name}} {{.Replicas}}' | grep -qE 'jhosuacom_api[[:space:]]+1/1'; then
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

