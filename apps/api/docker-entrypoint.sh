#!/bin/sh
set -e

DB_HOST="${DB_HOST:-jhosua-db}"
DB_PORT="${DB_PORT:-5432}"

# Siempre reconstruir DATABASE_URL desde DB_PASSWORD (encodeURIComponent).
# Compose inyecta URL sin encode → caracteres especiales rompen auth.
if [ -n "${DB_PASSWORD:-}" ]; then
  ENC=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$DB_PASSWORD")
  export DATABASE_URL="postgres://${DB_USER:-jhosua}:${ENC}@${DB_HOST}:${DB_PORT}/${DB_NAME:-jhosua}"
  echo "🔐 DATABASE_URL reconstruida desde DB_PASSWORD"
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

# migrate/seed: solo offline / one-shot (imagen slim ya no incluye drizzle-kit)
if [ "${RUN_DB_PUSH:-false}" = "true" ]; then
  echo "ℹ️  RUN_DB_PUSH=true ignorado (usar drizzle localmente)"
fi
if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "ℹ️  RUN_DB_SEED=true ignorado (usar seed localmente)"
fi

echo "🚀 API :${API_PORT:-3000}"
exec "$@"
