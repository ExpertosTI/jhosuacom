#!/bin/sh
# Arranque API — no tumbar el proceso si migrate/seed fallan
set -e

cd /app

echo "⏳ Esperando Postgres..."
node <<'NODE'
const postgres = require('postgres');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL required');
  process.exit(1);
}
(async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const sql = postgres(url, { max: 1, connect_timeout: 3 });
      await sql`select 1`;
      await sql.end({ timeout: 1 });
      console.log('✅ Postgres listo');
      process.exit(0);
    } catch (e) {
      if (i === 59) {
        console.error('❌ Timeout Postgres:', e && e.message);
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
})();
NODE

# Migrate/seed: best-effort (no tumbar API)
if [ "${RUN_DB_PUSH:-true}" = "true" ]; then
  echo "📦 Schema push..."
  (cd /app/packages/db && pnpm exec drizzle-kit push --force) \
    || echo "⚠️  drizzle push falló (se reintentará en próximo deploy)"
fi

if [ "${RUN_DB_SEED:-true}" = "true" ]; then
  echo "🌱 Seed..."
  (cd /app/packages/db && pnpm exec tsx src/seed.ts) \
    || echo "⚠️  seed falló (puede que admin ya exista)"
fi

cd /app/apps/api
echo "🚀 Starting API on :${API_PORT:-3000}"
exec "$@"
