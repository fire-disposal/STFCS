# =============================================
# STFCS Client Dockerfile
# Vue 3 + Vite Frontend with tsup build
# =============================================

# ==================== Stage 1: Dependencies ====================
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Copy only package files for dependency installation
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/rules/package.json ./packages/rules/
COPY packages/client/package.json ./packages/client/

RUN pnpm fetch --frozen-lockfile
RUN pnpm install --frozen-lockfile --offline

# ==================== Stage 2: Builder ====================
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-store ./pnpm-store

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/rules/package.json ./packages/rules/
COPY packages/client/package.json ./packages/client/

# Install from store (fast)
RUN pnpm install --frozen-lockfile --offline

# Copy source code
COPY packages/contracts ./packages/contracts
COPY packages/rules ./packages/rules
COPY packages/client ./packages/client

# Build dependency packages first
RUN pnpm --filter @vt/contracts build
RUN pnpm --filter @vt/rules build

# Build client (Vite build)
RUN pnpm --filter client build

# ==================== Stage 3: Runner (Nginx) ====================
FROM nginx:alpine AS runner

# Copy custom nginx config
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html

# Create non-root user and set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Switch to non-root user
USER nginx

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
