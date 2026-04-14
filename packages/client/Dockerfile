FROM node:24-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/data/package.json ./packages/data/
COPY packages/rules/package.json ./packages/rules/
COPY packages/client/package.json ./packages/client/

RUN pnpm install --frozen-lockfile

COPY packages/types ./packages/types
COPY packages/data ./packages/data
COPY packages/rules ./packages/rules
COPY packages/client ./packages/client

RUN pnpm --filter @vt/types build
RUN pnpm --filter @vt/data build
RUN pnpm --filter @vt/rules build
RUN pnpm --filter client build

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