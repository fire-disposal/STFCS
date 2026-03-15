# STFCS 快速启动指南

## 🚀 开发环境启动

### 前置条件

```bash
# 安装 Node.js (推荐 v18+)
# 安装 pnpm
npm install -g pnpm

# 安装依赖
pnpm install
```

### 启动开发服务器

```bash
# 方式 1：一键启动所有服务（推荐）
pnpm dev

# 方式 2：分别启动
# Terminal 1 - 启动后端
cd packages/server && pnpm dev

# Terminal 2 - 启动前端
cd packages/client && pnpm dev
```

### 访问应用

- **前端**: http://localhost:5173
- **后端 API**: http://localhost:3000
- **WebSocket**: ws://localhost:3001 (通过 `/ws` 代理)

### 端口配置

| 服务 | 默认端口 | 环境变量 |
|------|---------|----------|
| Vite Dev Server | 5173 | - |
| HTTP API Server | 3000 | `HTTP_PORT` |
| WebSocket Server | 3001 | `WS_PORT` |

### 环境变量配置

创建 `.env` 文件（项目根目录）：

```bash
# 服务器配置
HTTP_PORT=3000
WS_PORT=3001
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
LOG_LEVEL=info
MAX_PLAYERS_PER_ROOM=8
```

## 🔍 验证连接

### 1. 检查后端服务

```bash
# 检查 HTTP 服务
curl http://localhost:3000/api/health

# 检查 WebSocket 服务
# 使用浏览器开发者工具或 wscat
wscat -c ws://localhost:3001
```

### 2. 检查前端连接

1. 打开浏览器访问 http://localhost:5173
2. 打开开发者工具 (F12)
3. 查看 Console 标签
4. 应该看到 `WebSocket connected to: ws://localhost:5173/ws`

### 3. 常见问题排查

#### 问题：WebSocket 连接失败

**错误信息**:
```
Firefox 无法建立到 ws://localhost:5173/ws 服务器的连接
```

**解决方案**:

1. 确认后端服务已启动
   ```bash
   # 检查端口占用
   netstat -ano | findstr :3001
   ```

2. 检查 Vite 代理配置
   ```typescript
   // packages/client/vite.config.ts
   proxy: {
     "/ws": {
       target: "ws://localhost:3001",  // ✅ 确保端口正确
       ws: true,
     },
   },
   ```

3. 检查 WebSocket URL
   ```typescript
   // packages/shared/src/constants/index.ts
   export const DEFAULT_WS_URL = getDefaultWsUrl();
   // 浏览器环境应返回：ws://${location.host}/ws
   ```

#### 问题：CORS 错误

**错误信息**:
```
Access to WebSocket at 'ws://localhost:3001' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**解决方案**:

更新 `.env` 文件：
```bash
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

重启后端服务。

## 📦 构建生产版本

```bash
# 构建所有包
pnpm build

# 构建单个包
pnpm build --filter=client
pnpm build --filter=server
pnpm build --filter=@vt/shared
```

## 🧪 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm test --filter=client
pnpm test --filter=server
```

## 🔧 类型检查

```bash
# 类型检查
pnpm typecheck

# Lint 检查
pnpm lint

# 格式化代码
pnpm format
```

## 📝 开发工作流

1. **启动开发服务器**: `pnpm dev`
2. **进行代码修改**
3. **自动热重载**: Vite 会自动刷新浏览器
4. **查看类型错误**: 终端会显示 TypeScript 错误
5. **提交前检查**: `pnpm check` (运行 lint + typecheck)

## 🐛 调试技巧

### 查看 WebSocket 消息

```javascript
// 在浏览器 Console 中运行
websocketService.on("SHIP_MOVED", (payload) => {
  console.log("Ship moved:", payload);
});
```

### 检查连接状态

```javascript
// 在浏览器 Console 中运行
websocketService.isConnected();  // true/false
websocketService.getConnectionState();  // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
```

### 手动发送消息

```javascript
// 在浏览器 Console 中运行
websocketService.send({
  type: "PLAYER_JOINED",
  payload: {
    id: "test-player",
    name: "Test Player",
    joinedAt: Date.now(),
    isActive: true,
    isDMMode: false,
  },
});
```

## 📚 相关文档

- [TypeScript 重构文档](./TypeScriptRefactoring.md)
- [架构文档](./Architecture.md)

---

**最后更新**: 2026-03-15
