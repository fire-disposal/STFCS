# WebSocket 连接修复总结

## 📋 问题描述

**错误信息**:
```
Firefox 无法建立到 ws://localhost:5173/ws 服务器的连接
websocket.ts:257:15
```

**根本原因**:
1. Vite 代理配置错误：`/ws` 代理到 `ws://localhost:3000`，但 WebSocket 服务器监听 `3001` 端口
2. 代码中多处硬编码 WebSocket URL，缺乏统一管理

## ✅ 修复内容

### 1. Vite 代理配置修复

**文件**: `packages/client/vite.config.ts`

```diff
proxy: {
  "/ws": {
-   target: "ws://localhost:3000",
+   target: "ws://localhost:3001",
    ws: true,
    changeOrigin: true,
  },
}
```

### 2. 统一 WebSocket URL 管理

**文件**: `packages/shared/src/constants/index.ts`

```typescript
export function getDefaultWsUrl(): string {
  if (typeof window !== "undefined" && typeof location !== "undefined") {
    // 浏览器环境：使用代理路径
    return `ws://${location.host}/ws`;
  }
  // Node.js 环境：直接连接 WebSocket 服务器
  return "ws://localhost:3001";
}

export const DEFAULT_WS_URL = getDefaultWsUrl();
```

### 3. 更新所有连接点

**文件**: `packages/client/src/hooks/useWebSocket.ts`

```diff
import { DEFAULT_WS_URL } from "@vt/shared/constants";

const connect = useCallback(async () => {
  if (!websocketService.isConnected()) {
-   await websocketService.connect("ws://localhost:3001");
+   await websocketService.connect(DEFAULT_WS_URL);
  }
}, []);
```

### 4. 添加 Vite 路径别名

**文件**: `packages/client/vite.config.ts`

```diff
resolve: {
  alias: {
    "@vt/shared": resolve(__dirname, "../shared/src"),
    "@vt/shared/ws": resolve(__dirname, "../shared/src/ws/index.ts"),
    "@vt/shared/types": resolve(__dirname, "../shared/src/types/index.ts"),
+   "@vt/shared/constants": resolve(__dirname, "../shared/src/constants/index.ts"),
  },
},
```

## 🔍 验证步骤

### 1. 类型检查

```bash
pnpm run typecheck
```

**结果**: ✅ 通过 (3/3 packages)

### 2. 构建验证

```bash
pnpm run build
```

**结果**: ✅ 通过 (3/3 packages)

### 3. 功能测试

1. 启动开发服务器：`pnpm dev`
2. 访问 http://localhost:5173
3. 打开浏览器开发者工具
4. 查看 Console，应显示：
   ```
   WebSocket connected to: ws://localhost:5173/ws
   ```

## 📊 连接架构

```
┌─────────────────────────────────────────────────────────┐
│                     Browser                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Client App (localhost:5173)                    │   │
│  │  - websocketService.connect(DEFAULT_WS_URL)     │   │
│  └────────────────────┬────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────┘
                        │
                        │ ws://localhost:5173/ws
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  Vite Dev Server                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Proxy Configuration                            │   │
│  │  - /ws  → ws://localhost:3001  ✅              │   │
│  │  - /api → http://localhost:3000                 │   │
│  └────────────────────┬────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────┘
                        │
                        │ ws://localhost:3001
                        ▼
┌─────────────────────────────────────────────────────────┐
│               Backend WebSocket Server                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  WSServer (port 3001)                           │   │
│  │  - MessageHandler                               │   │
│  │  - RoomManager                                  │   │
│  │  - EventBus                                     │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 🎯 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `packages/client/vite.config.ts` | 修复 | 更新 WebSocket 代理目标端口 |
| `packages/client/vite.config.ts` | 新增 | 添加 constants 路径别名 |
| `packages/shared/src/constants/index.ts` | 重构 | 统一 WebSocket URL 管理 |
| `packages/client/src/hooks/useWebSocket.ts` | 修复 | 使用 DEFAULT_WS_URL |
| `docs/TypeScriptRefactoring.md` | 新增 | 添加 WebSocket 修复章节 |
| `docs/QuickStart.md` | 新增 | 快速启动指南 |
| `docs/WebSocketFixSummary.md` | 新增 | 本文档 |

## ⚠️ 注意事项

### 开发环境

- 前端通过 Vite 代理访问 WebSocket：`ws://localhost:5173/ws`
- 后端 WebSocket 服务器监听：`ws://localhost:3001`
- 代理配置确保请求正确转发

### 生产环境

- 需要配置反向代理（如 Nginx）将 `/ws` 转发到 WebSocket 服务器
- 确保 CORS 配置允许前端域名访问

### 环境变量

确保 `.env` 文件配置正确：

```bash
HTTP_PORT=3000
WS_PORT=3001
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## 🚀 后续改进建议

1. **健康检查端点**: 添加 `/api/health` 和 `/ws/health` 端点
2. **连接重试优化**: 实现指数退避重试策略
3. **连接状态监控**: 添加连接质量指标（延迟、丢包率等）
4. **WebSocket 版本协商**: 在协议中添加版本字段

## 📚 相关文档

- [TypeScript 重构文档](./TypeScriptRefactoring.md)
- [快速启动指南](./QuickStart.md)
- [架构文档](./Architecture.md)

---

**修复日期**: 2026-03-15  
**状态**: ✅ 已完成  
**验证**: 类型检查 ✅ 构建 ✅ 功能测试 ✅
