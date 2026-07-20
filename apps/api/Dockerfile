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

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=3000
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/api ./apps/api
COPY apps/api/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
WORKDIR /app/apps/api
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/main.js"]
