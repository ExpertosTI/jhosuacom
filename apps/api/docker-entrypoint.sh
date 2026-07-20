#!/bin/sh
set -e

DB_HOST="${DB_HOST:-jhosua-db}"
DB_PORT="${DB_PORT:-5432}"

if [ -z "${DATABASE_URL:-}" ] && [ -n "${DB_PASSWORD:-}" ]; then
  ENC=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$DB_PASSWORD")
  export DATABASE_URL="postgres://${DB_USER:-jhosua}:${ENC}@${DB_HOST}:${DB_PORT}/${DB_NAME:-jhosua}"
fi

echo "⏳ Esperando Postgres TCP ${DB_HOST}:${DB_PORT}..."
node <<'NODE'
const net = require('net');
const host = process.env.DB_HOST || 'jhosua-db';
const port = Number(process.env.DB_PORT || 5432);
let tries = 0;
(function attempt() {
  tries += 1;
  const s = net.connect({ host, port }, () => {
    s.end();
    console.log('✅ Postgres listo');
    process.exit(0);
  });
  s.on('error', () => {
    s.destroy();
    if (tries >= 60) {
      console.error('❌ Timeout Postgres');
      process.exit(1);
    }
    setTimeout(attempt, 2000);
  });
})();
NODE

# Migrate + seed solo si se pide explícitamente (por defecto OFF: evita OOM en Swarm)
if [ "${RUN_DB_PUSH:-false}" = "true" ] && [ -d /opt/db ]; then
  echo "📦 drizzle push..."
  export NODE_PATH="/opt/db-node_modules:${NODE_PATH:-}"
  (cd /opt/db && NODE_PATH="/opt/db-node_modules" /opt/db-node_modules/.bin/drizzle-kit push --force) \
    || echo "⚠️  push omitido"
fi

if [ "${RUN_DB_SEED:-false}" = "true" ] && [ -d /opt/db ]; then
  echo "🌱 seed..."
  export NODE_PATH="/opt/db-node_modules:${NODE_PATH:-}"
  (cd /opt/db && NODE_PATH="/opt/db-node_modules" /opt/db-node_modules/.bin/tsx src/seed.ts) \
    || echo "⚠️  seed omitido"
fi

echo "🚀 API :${API_PORT:-3000}"
exec "$@"
