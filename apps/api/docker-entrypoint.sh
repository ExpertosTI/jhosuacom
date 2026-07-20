#!/bin/sh
set -e

echo "⏳ Esperando Postgres..."
node <<'NODE'
const postgres = require('postgres');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL required');
  process.exit(1);
}
(async () => {
  for (let i = 0; i < 40; i++) {
    try {
      const sql = postgres(url, { max: 1, connect_timeout: 3 });
      await sql`select 1`;
      await sql.end({ timeout: 1 });
      console.log('✅ Postgres listo');
      process.exit(0);
    } catch (e) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.error('❌ Timeout esperando Postgres');
  process.exit(1);
})();
NODE

cd /app/packages/db

if [ "${RUN_DB_PUSH:-true}" = "true" ]; then
  echo "📦 drizzle-kit push..."
  pnpm exec drizzle-kit push --force || npx drizzle-kit push --force || true
fi

if [ "${RUN_DB_SEED:-true}" = "true" ]; then
  echo "🌱 seed..."
  pnpm exec tsx src/seed.ts || npx tsx src/seed.ts || true
fi

cd /app/apps/api
exec "$@"
