#!/bin/bash
# ==============================================================================
# JH Hogar / JhosuaComercial — Deploy Swarm (mismo protocolo que Catagce/Renace)
# VPS: /opt/jhosuacom
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

# Permite correr desde el propio repo si no está en /opt
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
  echo "✅ .env creado"
fi

# Cargar .env (igual que Catagce deploy.sh)
set -a
# shellcheck disable=SC1091
. ./.env
set +a

echo "🌐 RenaceNet..."
if ! docker network inspect RenaceNet >/dev/null 2>&1; then
  docker network create --driver overlay --attachable RenaceNet
else
  echo "ℹ️  RenaceNet ok"
fi

# Si queda el stack de maintenance con el mismo nombre, se reemplaza al deploy
if docker stack ls 2>/dev/null | awk '{print $1}' | grep -qx "$STACK"; then
  echo "ℹ️  Stack $STACK ya existe → se actualizará"
fi

echo "🏗️  Build images..."
docker compose build --parallel

echo "🚢 Stack deploy..."
# Mismo patrón Catagce: interpolar con compose config, luego swarm
docker stack deploy -c <(docker compose config) "$STACK"

echo "🔄 Force update servicios app..."
docker service update --force "${STACK}_api"
docker service update --force "${STACK}_web"

echo "-----------------------------------"
echo "✅ Deploy OK"
echo "   Web:   https://jhosuacomercial.com"
echo "   API:   https://api.jhosuacomercial.com/api/health"
echo "   Admin: https://jhosuacomercial.com/admin"
echo "-----------------------------------"
docker stack services "$STACK"
