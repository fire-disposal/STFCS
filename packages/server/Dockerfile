# =============================================
# STFCS Server Dockerfile
# Optimized for Node 24 & pnpm 10
# =============================================

# Stage 1: Dependencies
FROM node:24-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN npm install -g pnpm@10.32.1

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:24-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@10.32.1

COPY --from=deps /app ./ 
# 直接拷贝整个 /app 包含 node_modules 和所有 package.json，比一个个拷贝更稳

COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY packages/client ./packages/client

RUN pnpm --filter @vt/shared build
RUN pnpm --filter client build
RUN pnpm --filter server build

# Stage 3: Runner
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pnpm@10.32.1

# 【关键点】必须包含 pnpm-lock.yaml 才能执行 --frozen-lockfile
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
# 将前端产物挂载到后端静态目录
COPY --from=builder /app/packages/client/dist ./packages/server/dist/public

# 现在有 lock 文件了，安装会成功
RUN pnpm install --prod --frozen-lockfile

# 权限设置
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 serveruser && \
    chown -R serveruser:nodejs /app
USER serveruser

EXPOSE 3000 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "packages/server/dist/main.cjs"]