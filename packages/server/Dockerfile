# =============================================
# STFCS Server Dockerfile
# Optimized for Node 24 & pnpm 10
# Build with tsup for faster compilation
# =============================================

# ==================== Stage 1: Dependencies ====================
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Copy only package files for dependency installation
COPY pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

RUN pnpm fetch --frozen-lockfile
RUN pnpm install --frozen-lockfile --offline

# ==================== Stage 2: Builder ====================
FROM node:24-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-store ./pnpm-store
COPY --from=deps /app/.pnpm-store ./pnpm-store

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install from store (fast)
RUN pnpm install --frozen-lockfile --offline

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY packages/client ./packages/client

# Build with tsup (fast compilation)
RUN pnpm --filter @vt/shared build
RUN pnpm --filter server build
RUN pnpm --filter client build

# ==================== Stage 3: Runner ====================
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 serveruser

# Copy package files for production install
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Copy built artifacts from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/client/dist ./packages/server/dist/public

# Install production dependencies only
RUN corepack enable && \
    pnpm install --prod --frozen-lockfile && \
    chown -R serveruser:nodejs /app

# Switch to non-root user
USER serveruser

EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start server
CMD ["node", "packages/server/dist/main.cjs"]
