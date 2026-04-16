FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Dependency stage
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/data/package.json ./packages/data/
COPY packages/rules/package.json ./packages/rules/
COPY packages/server/package.json ./packages/server/
COPY packages/schema-types/package.json ./packages/schema-types/
COPY packages/client/package.json ./packages/client/
RUN pnpm install --frozen-lockfile

# Build stage
FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/data ./packages/data
COPY packages/rules ./packages/rules
COPY packages/server ./packages/server
COPY packages/schema-types ./packages/schema-types
COPY packages/client ./packages/client
RUN pnpm --filter @vt/data build && \
    pnpm --filter @vt/rules build && \
    pnpm --filter @vt/server build && \
    pnpm --filter @vt/schema-types build && \
    pnpm --filter client build

# Runtime stage
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 serveruser

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/data/package.json ./packages/data/
COPY packages/rules/package.json ./packages/rules/
COPY packages/server/package.json ./packages/server/

COPY --from=builder /app/packages/data/dist ./packages/data/dist
COPY --from=builder /app/packages/rules/dist ./packages/rules/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/client/dist ./packages/server/dist/public

RUN corepack enable && \
    pnpm install --prod --frozen-lockfile && \
    chown -R serveruser:nodejs /app

USER serveruser
EXPOSE 2567
CMD ["node", "packages/server/dist/index.js"]

EXPOSE 2567

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:2567/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "packages/server/dist/index.js"]