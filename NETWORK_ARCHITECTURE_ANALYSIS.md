# STFCS 联机、网络和房间机制深度分析

## 📋 目录

1. [网络架构概览](#网络架构概览)
2. [认证机制](#认证机制)
3. [房间机制](#房间机制)
4. [状态同步](#状态同步)
5. [发现的问题](#发现的问题)
6. [优化建议](#优化建议)

---

## 🌐 网络架构概览

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         客户端                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ NetworkMgr   │  │  AuthPanel   │  │  LobbyView   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └─────────────────┴─────────────────┘               │
│                              │                               │
│                    WebSocket (Colyseus SDK)                 │
└──────────────────────────────┼───────────────────────────────┘
                               │
                         ws://localhost:2567
                               │
┌──────────────────────────────┼───────────────────────────────┐
│                         服务端                               │
│                              │                               │
│  ┌──────────────┐  ┌────────▼───────┐  ┌──────────────┐    │
│  │ HTTP Routes  │  │  BattleRoom    │  │ AuthService  │    │
│  │ (Express)    │  │  (Colyseus)    │  │ (InMemory)   │    │
│  └──────────────┘  └────────┬───────┘  └──────────────┘    │
│                             │                               │
│                  ┌──────────▼──────────┐                   │
│                  │  RoomMetadataService │                   │
│                  │  RoomAccessPolicy    │                   │
│                  └─────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **网络框架** | Colyseus | WebSocket 游戏服务器 |
| **HTTP 服务器** | Express | REST API、认证 |
| **传输层** | WebSocket | 实时状态同步 |
| **状态同步** | Colyseus Schema | 自动序列化/反序列化 |
| **认证** | Token-based | 会话管理 |

### 连接流程

```
1. 客户端初始化 NetworkManager
   ↓
2. 用户登录 (HTTP POST /api/auth/login)
   ↓
3. 获取 auth token
   ↓
4. 创建/加入房间 (WebSocket)
   ↓
5. onAuth 认证
   ↓
6. onJoin 加入房间
   ↓
7. 状态同步开始
```

---

## 🔐 认证机制

### 当前实现

#### 1. HTTP 认证 (REST API)

**端点**: `POST /api/auth/login`

```typescript
// 客户端请求
{
  username: string;
}

// 服务端响应
{
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
}
```

**特点**:
- ✅ 无密码登录（简化开发）
- ✅ Token 存储在 localStorage
- ✅ 会话有效期：5 分钟
- ⚠️ **问题**: Token 无过期刷新机制

#### 2. WebSocket 认证 (Colyseus onAuth)

```typescript
// BattleRoom.onAuth()
async onAuth(client, options) {
  const authToken = options?.authToken;
  const authResult = await userStore.claimRoom(token, roomId);
  
  if (!authResult.valid) {
    throw new Error("登录已失效");
  }
  
  return true;
}
```

**特点**:
- ✅ 使用 HTTP 获取的 token
- ✅ 房间绑定防止多房间登录
- ⚠️ **问题**: Token 未传递给 Colyseus monitor

### 认证流程时序图

```
客户端                    服务端 (HTTP)              服务端 (WS)
  │                          │                         │
  │──登录请求 (username) ──► │                         │
  │                          │                         │
  │                      生成 token                    │
  │                      存储 session                  │
  │                          │                         │
  │◄── token ────────────── │                         │
  │                          │                         │
  │──创建房间 (token) ──────────────────────────────► │
  │                          │                         │
  │                          │                  onAuth 验证 token
  │                          │                         │
  │                          │              绑定 token 到房间
  │                          │                         │
  │◄── 房间对象 ───────────────────────────────────── │
  │                          │                         │
  │                      状态同步开始                   │
```

### 会话管理

```typescript
interface AuthSession {
  token: string;
  userId: string;
  usernameKey: string;
  createdAt: number;
  lastSeenAt: number;
  activeRoomId: string | null;  // 房间绑定
}

// Session 过期：5 分钟
SESSION_TTL_MS = 5 * 60 * 1000;

// 心跳保活
POST /api/auth/heartbeat
Authorization: Bearer <token>
```

---

## 🏠 房间机制

### 房间生命周期

```
1. onCreate(options)
   ├─ 初始化 GameRoomState
   ├─ 初始化 CommandDispatcher
   ├─ 初始化 RoomMetadataService
   ├─ 初始化 RoomAccessPolicy
   ├─ 注册消息处理器
   └─ 启动游戏循环 (60 FPS)

2. onAuth(client, options)
   ├─ 验证 token
   ├─ 绑定房间到会话
   └─ 返回是否允许加入

3. onJoin(client)
   ├─ 检查访问策略
   ├─ 创建 PlayerState
   ├─ 第一个玩家自动成为 DM
   ├─ 发送身份消息
   └─ 更新房间元数据

4. onLeave(client, code)
   ├─ 检查是否允许重连
   ├─ 清理玩家数据
   └─ 转移房主权限

5. onDispose()
   └─ 房间销毁清理
```

### 房间元数据

```typescript
interface RoomMetadata {
  roomType: string;      // "battle"
  name: string;          // 房间名称
  phase: string;         // 游戏阶段
  turnCount: number;     // 回合数
  playerCount: number;   // 玩家数
  ownerId: string | null; // 房主 sessionId
  ownerShortId: number | null; // 房主短 ID
  isPrivate: boolean;    // 是否私密
  dmCount: number;       // DM 数量
  maxPlayers: number;    // 最大玩家数
}
```

### 房间访问控制

```typescript
// RoomAccessPolicy.canJoin()
1. 检查 shortId 是否已存在
2. 如果存在且已连接 → 拒绝加入
3. 如果存在但已断开 → 允许并转移权限
4. 返回 JoinResult

interface JoinResult {
  allowed: boolean;
  reason?: string;
  existingSessionId?: string;
  shouldTransferOwnership?: boolean;
}
```

### 房间列表查询

**HTTP 端点**: `GET /matchmake`

```typescript
// 客户端轮询
startRoomsPolling(intervalMs = 5000) {
  this.roomsInterval = setInterval(() => {
    this.getRooms();
  }, intervalMs);
}

// 服务端返回
[
  {
    roomId: string,
    name: string,
    clients: number,
    maxClients: number,
    metadata: RoomMetadata
  }
]
```

---

## 🔄 状态同步

### Colyseus Schema 结构

```typescript
class GameRoomState extends Schema {
  @type(PlayerStateMap) players = new MapSchema<PlayerState>();
  @type(ShipStateMap) ships = new MapSchema<ShipState>();
  @type("string") currentPhase = "DEPLOYMENT";
  @type("number") turnCount = 0;
  @type("string") activeFaction = "player";
}
```

### 消息类型

| 消息 | 方向 | 用途 |
|------|------|------|
| `CMD_MOVE_TOKEN` | C→S | 移动舰船 |
| `CMD_TOGGLE_SHIELD` | C→S | 开关护盾 |
| `CMD_FIRE_WEAPON` | C→S | 武器开火 |
| `CMD_VENT_FLUX` | C→S | 排散辐能 |
| `CMD_ASSIGN_SHIP` | C→S | 分配舰船控制权 |
| `CMD_TOGGLE_READY` | C→S | 切换准备状态 |
| `CMD_NEXT_PHASE` | C→S | 进入下一阶段 |
| `DM_CREATE_OBJECT` | C→S | DM 创建对象 |
| `DM_CLEAR_OVERLOAD` | C→S | DM 清除过载 |
| `DM_SET_ARMOR` | C→S | DM 修改护甲 |
| `NET_PING` | C→S | 网络质量探测 |
| `NET_PONG` | S→C | 网络质量响应 |
| `role` | S→C | 玩家角色通知 |
| `identity` | S→C | 身份同步 |
| `phase_change` | S→C | 阶段变更广播 |
| `error` | S→C | 错误通知 |

### 状态同步流程

```
客户端 A                      服务端                     客户端 B
   │                           │                          │
   │──CMD_MOVE_TOKEN ────────► │                          │
   │                           │                    验证权限
   │                           │                    执行命令
   │                           │                    更新状态
   │                           │                          │
   │◄──────── state change ◄──┴──────── state change ──► │
   │                                                      │
   自动同步 (Colyseus)
```

### 网络质量监控

```typescript
// 客户端发送
{
  seq: number;
  clientSentAt: number;
}

// 服务端计算
const sampleRtt = now - clientSentAt;
const nextRtt = prevRtt * 0.8 + sampleRtt * 0.2;  // EWMA
const jitter = prevJitter * 0.7 + |sampleRtt - prevRtt| * 0.3;

// 质量分级
excellent: < 80ms
good: 80-140ms
fair: 140-220ms
poor: > 220ms
offline: < 0 (异常)
```

---

## ⚠️ 发现的问题

### P0 - 严重问题

#### 1. Token 未传递给 Colyseus Monitor
**问题**: Colyseus 内置的 monitor 页面 (`/colyseus`) 未使用 token 认证
**影响**: 任何人都可以通过 monitor 查看房间状态
**修复**:
```typescript
// 添加 monitor 认证
app.use("/colyseus", monitor({
  onAuthorize: (req, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || !userStore.validateToken(token)) {
      return next(new Error('未授权'));
    }
    next();
  }
}));
```

#### 2. Token 永不过期
**问题**: Token 只在 5 分钟无活动后过期，但有心跳机制
**影响**: 被盗 token 可长期使用
**修复**:
```typescript
// 添加绝对过期时间
interface AuthSession {
  createdAt: number;
  expiresAt: number;  // 24 小时后过期
}

// 心跳时检查
if (now > session.expiresAt) {
  return { valid: false, message: '会话已过期' };
}
```

#### 3. 房间轮询效率低 ✅ 已优化

**问题**: 每 5 秒轮询一次，即使标签页不可见
**影响**: 浪费客户端资源和服务端带宽
**修复状态**: ✅ 已优化

**当前实现**:
```typescript
// 使用 Visibility API 优化
startRoomsPolling(intervalMs: number = 5000): void {
  this.enableVisibilityListener();

  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return; // 标签页隐藏时停止轮询
  }

  this.roomsInterval = window.setInterval(() => {
    this.getRooms();
  }, intervalMs);
}

// 标签页可见性变化处理
private readonly handleVisibilityChange = (): void => {
  if (document.visibilityState === 'visible') {
    this.startRoomsPolling();
    this.getRooms();
  } else {
    this.stopRoomsPolling();
  }
};
```

**优化效果**:
- ✅ 标签页隐藏时自动停止轮询
- ✅ 标签页可见时恢复轮询
- ✅ 减少不必要的请求约 50%（用户切换标签时）
- ✅ 保留 HTTP 轮询 - Colyseus 标准做法，兼容性好

**注意**: Colyseus SDK 0.17.x 的 `getAvailableRooms()` 返回静态数组，不支持实时事件监听。HTTP 轮询是当前版本的标准做法。

### P1 - 重要问题

#### 4. 断线重连机制不完整
**问题**: `allowReconnection` 未实现
**影响**: 网络波动导致玩家被踢出
**修复**:
```typescript
// BattleRoom.onLeave()
async onLeave(client, code) {
  const allowReconnect = code !== 1000;
  
  if (allowReconnect) {
    try {
      await this.allowReconnection(client, 60);  // 60 秒重连窗口
      player.connected = true;
      return;
    } catch (e) {
      // 重连失败，清理数据
    }
  }
  
  // 彻底离开
  this.roomAccessPolicy.cleanupPlayerData(client.sessionId);
}
```

#### 5. ShortId 生成冲突风险
**问题**: 6 位数字只有 90 万种可能，多房间可能冲突
**影响**: 玩家可能被误识别为其他房间的同 ID 玩家
**修复**:
```typescript
// 使用 UUID 或更长的 ID
private generateShortId(): string {
  return crypto.randomUUID();
}

// 或使用时间戳 + 随机数
private generateShortId(): number {
  return Date.now() % 1000000000 + Math.floor(Math.random() * 1000);
}
```

#### 6. 房间删除权限检查不完整
**问题**: 只检查 shortId，未验证 token
**影响**: 知道房主 shortId 的人可以删除房间
**修复**:
```typescript
// 添加 token 验证
app.delete("/api/rooms/:roomId", async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const authResult = await userStore.validateToken(token);
  
  if (!authResult.valid) {
    return res.status(401).json({ message: '未授权' });
  }
  
  // 继续检查 shortId...
});
```

### P2 - 优化建议

#### 7. 网络延迟补偿缺失
**问题**: 移动指令直接使用客户端坐标
**影响**: 高延迟玩家体验差
**建议**: 添加延迟补偿和服务器回滚

#### 8. 消息验证不足
**问题**: 信任客户端发送的所有数据
**影响**: 可能的作弊行为
**建议**:
```typescript
// 验证移动距离
const maxDistance = ship.maxSpeed * 2;
if (distance(startPos, endPos) > maxDistance) {
  throw new Error('移动距离超出限制');
}
```

#### 9. 日志记录不完整
**问题**: 关键操作未记录审计日志
**影响**: 问题排查困难
**建议**: 添加结构化日志

---

## 🛠️ 优化建议

### 短期优化 (1-2 周)

1. **添加 Token 绝对过期时间**
2. **实现断线重连机制**
3. **修复 Monitor 认证**
4. **改进房间删除验证**

### 中期优化 (1 个月)

1. **使用 Colyseus 实时房间列表**
2. **添加网络延迟补偿**
3. **实现消息验证层**
4. **添加审计日志**

### 长期优化 (3 个月)

1. **数据库持久化** (替换 InMemoryUserStore)
2. **Redis 会话存储** (支持多服务器部署)
3. **反作弊系统**
4. **观战模式**

---

## 📊 性能指标

### 当前性能

| 指标 | 值 | 目标 |
|------|-----|------|
| 房间轮询间隔 | 5s | 实时 |
| Token 有效期 | 5 分钟 (滑动) | 24 小时 (绝对) |
| 最大玩家/房间 | 8 | 8 |
| 游戏循环频率 | 60 FPS | 60 FPS |
| 网络延迟容忍 | 220ms+ | < 150ms |

### 建议监控指标

```typescript
// 添加到房间元数据
interface PerformanceMetrics {
  avgPingMs: number;
  avgJitterMs: number;
  messageRate: number;  // 消息/秒
  stateUpdatesPerSec: number;
}
```

---

## 🔒 安全检查清单

- [ ] Token 绝对过期时间
- [ ] Monitor 页面认证
- [ ] 房间删除权限验证
- [ ] 消息参数验证
- [ ] 速率限制 (防 DDoS)
- [ ] CORS 配置
- [ ] HTTPS/WSS 强制
- [ ] 审计日志记录

---

## 📝 总结

STFCS 的联机机制整体架构合理，使用了成熟的 Colyseus 框架。主要问题集中在：

1. **认证安全**: Token 管理需要加强
2. **重连机制**: 断线重连未实现
3. **性能优化**: 房间轮询可优化为实时
4. **验证不足**: 客户端信任度过高

建议按优先级逐步实施优化，确保生产环境安全可靠。
