FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY packages/db packages/db
COPY apps/api apps/api
COPY tsconfig.json ./
RUN pnpm --filter @jhosua/db build
RUN pnpm --filter @jhosua/api build && test -f apps/api/dist/main.js
RUN pnpm --filter @jhosua/api --prod deploy /prod --legacy

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=3000
ENV DB_HOST=jhosua-db
ENV DB_PORT=5432
COPY --from=builder /prod/ ./
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/db/dist ./node_modules/@jhosua/db/dist
COPY --from=builder /app/packages/db/package.json ./node_modules/@jhosua/db/package.json
# Schema tools (migrate/seed one-shot desde deploy)
COPY --from=builder /app/packages/db /opt/db
COPY --from=builder /app/node_modules /opt/db-node_modules
COPY apps/api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && test -f dist/main.js \
  && node -e "require('@jhosua/db'); console.log('api image ok')"
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/main.js"]
