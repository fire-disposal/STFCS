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
FROM nginx:alpine AS runner

COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]