#!/bin/bash
set -e
VPS="root@45.9.191.18"
REMOTE_DIR="/opt/jhosuacom-maintenance"
STACK="jhosuacom"
TAG="v-$(date +%M%S)"
IMAGE="jhosuacom-maintenance:$TAG"

echo "🏗️  Compilando local..."
docker build -t $IMAGE .
docker save $IMAGE | gzip > maintenance.tar.gz

echo "📡  Enviando..."
ssh $VPS "mkdir -p $REMOTE_DIR"
scp maintenance.tar.gz $VPS:$REMOTE_DIR/
cat docker-compose.yml | sed "s/latest/$TAG/" > docker-compose.v.yml
scp docker-compose.v.yml $VPS:$REMOTE_DIR/docker-compose.yml
rm maintenance.tar.gz docker-compose.v.yml

echo "🚀  Desplegando..."
ssh $VPS bash << REMOTE
  docker load < maintenance.tar.gz
  rm maintenance.tar.gz
  docker stack deploy --detach=true -c docker-compose.yml $STACK
  docker service update --force ${STACK}_web
  docker image prune -f
  echo "✅ Despliegue completado."
REMOTE
