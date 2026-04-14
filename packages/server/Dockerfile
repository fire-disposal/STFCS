FROM node:24-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/data/package.json ./packages/data/
COPY packages/rules/package.json ./packages/rules/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

RUN pnpm install --frozen-lockfile

COPY packages/types ./packages/types
COPY packages/data ./packages/data
COPY packages/rules ./packages/rules
COPY packages/server ./packages/server
COPY packages/client ./packages/client

RUN pnpm --filter @vt/types build
RUN pnpm --filter @vt/data build
RUN pnpm --filter @vt/rules build
RUN pnpm --filter server build

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 serveruser

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/data/package.json ./packages/data/
COPY packages/rules/package.json ./packages/rules/
COPY packages/server/package.json ./packages/server/

COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/data/dist ./packages/data/dist
COPY --from=builder /app/packages/rules/dist ./packages/rules/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/client/dist ./packages/server/dist/public

RUN corepack enable && \
    pnpm install --prod --frozen-lockfile && \
    chown -R serveruser:nodejs /app

USER serveruser

EXPOSE 2567

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:2567/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "packages/server/dist/index.js"]