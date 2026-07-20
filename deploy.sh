#!/bin/bash
# ==============================================================================
# JH Hogar / JhosuaComercial — Deploy Swarm (Renace VPS)
# Ejecutar en el servidor: /opt/jhosuacom
# ==============================================================================
set -euo pipefail

STACK="jhosuacom"
BRANCH="${DEPLOY_BRANCH:-feat/jh-hogar-mvp}"
PROJECT_DIR=""

for dir in /opt/jhosuacom /opt/jhosuacomercial "$PWD"; do
  if [ -d "$dir" ] && [ -f "$dir/docker-compose.yml" ]; then
    PROJECT_DIR="$dir"
    break
  fi
done

if [ -z "$PROJECT_DIR" ]; then
  echo "❌ No se encontró jhosuacom (busca /opt/jhosuacom)"
  exit 1
fi

cd "$PROJECT_DIR"

echo "-----------------------------------"
echo "🛰️  JH Hogar deploy → stack=$STACK branch=$BRANCH"
echo "-----------------------------------"

echo "📥 Sync Git..."
git fetch --all
git checkout "$BRANCH" || git checkout -b "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "🔐 Environment..."
if [ ! -f .env ]; then
  DB_PASS="$(openssl rand -base64 24 | tr -d '\n/=+' | cut -c1-32)"
  JWT="$(openssl rand -base64 32 | tr -d '\n/=+' | cut -c1-48)"
  ADMIN_PASS="${ADMIN_PASSWORD:-JhHogarAdmin2026!}"
  cat > .env <<EOF
DB_USER=jhosua
DB_PASSWORD=${DB_PASS}
DB_NAME=jhosua
DATABASE_URL=postgres://jhosua:${DB_PASS}@jhosua-db:5432/jhosua
JWT_SECRET=${JWT}
ADMIN_EMAIL=admin@jhhogar.com
ADMIN_PASSWORD=${ADMIN_PASS}
NEXT_PUBLIC_API_URL=https://api.jhosuacomercial.com/api
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
  echo "✅ .env creado (edita Odoo/WhatsApp después)"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "🌐 RenaceNet..."
docker network ls | grep -q RenaceNet || docker network create --driver overlay RenaceNet

echo "🏗️  Build images..."
docker compose build --parallel

echo "🚢 Stack deploy..."
# Quitar stack maintenance viejo si solo tenía landing estática
if docker stack ls | grep -q "^${STACK} "; then
  echo "ℹ️  Actualizando stack existente $STACK"
fi

docker stack deploy -c <(docker compose config) "$STACK"

echo "🔄 Force update..."
docker service update --force "${STACK}_api" || true
docker service update --force "${STACK}_web" || true

echo "-----------------------------------"
echo "✅ Deploy OK"
echo "   Web: https://jhosuacomercial.com"
echo "   API: https://api.jhosuacomercial.com/api/health"
echo "   Admin: https://jhosuacomercial.com/admin"
echo "-----------------------------------"
docker service ls | grep "$STACK" || true
