#!/bin/bash
# Script de Deployment - JhosuaComercial (Protocolo Renace)
# Ejecutar en el servidor: /opt/jhosuacom-maintenance
set -e

STACK="jhosuacom"
BRANCH="main"

echo "🚀 Iniciando deployment de JhosuaComercial (Docker Swarm)..."

# 1. Pull latest changes
echo "📥 1/4 - Sincronizando con Git..."
git fetch origin
git reset --hard origin/$BRANCH

# 2. Build image locally on VPS (Solo copia archivos, no consume recursos)
echo "🔨 2/4 - Building imagen Docker..."
docker compose build --no-cache

# 3. Ensure Network
echo "🌐 3/4 - Asegurando red RenaceNet..."
docker network ls | grep RenaceNet > /dev/null || docker network create --driver overlay RenaceNet

# 4. Deploy Stack
echo "🚀 4/4 - Desplegando Stack..."
docker stack deploy -c docker-compose.yml $STACK

# 5. Force update para asegurar que tome la nueva imagen local
echo "🔄 Forzando actualización de servicios..."
docker service update --force ${STACK}_web

echo "✨ Deployment completado con éxito!"
