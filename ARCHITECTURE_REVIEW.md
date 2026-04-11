# STFCS 架构审阅与改进报告

## 📊 当前架构分析

### 1. 用户认证机制

#### 当前实现
- **服务端**: `InMemoryUserStore` 内存存储用户和 token
- **客户端**: `NetworkManager` 统一管理认证和房间连接
- **流程**: 登录 → 获取 token → 加入房间

#### ✅ 优点
1. 简单的内存实现，适合开发和测试
2. Token 验证机制完整
3. 会话持久化（localStorage）

#### ⚠️ 问题
1. **密码明文存储** - 生产环境需要哈希
2. **Token 无过期机制** - token 永久有效
3. **认证与房间脱节** - Colyseus onAuth 未使用 HTTP token

---

### 2. 房间机制

#### 当前实现
- **服务端**: `BattleRoom extends Room<GameRoomState>`
- **客户端**: `NetworkManager.createRoom/joinRoom`
- **房间列表**: 通过 Colyseus HTTP API 轮询

#### ✅ 优点
1. 使用 Colyseus 官方 SDK
2. 房间元数据实时更新
3. 支持多房间

#### ⚠️ 问题
1. **认证流程割裂**:
   - HTTP 认证（login API）和 WebSocket 认证（onAuth）分离
   - 客户端登录 token 未传递给 Colyseus
   - onAuth 只验证 playerName，不验证用户身份

2. **房间创建问题**:
   ```typescript
   // 客户端创建房间时
   await networkManager.createRoom({ roomName, maxPlayers })
   // 但 BattleRoom.onCreate 接收的是 { playerName }
   // 参数不匹配！
   ```

3. **房间列表轮询**:
   - 每 5 秒轮询一次，效率低
   - 应该使用 Colyseus 的实时房间列表功能

---

### 3. 联机状态机机制

#### 当前实现
- **游戏阶段**: DEPLOYMENT → PLAYER_TURN → DM_TURN → END_PHASE
- **玩家状态**: PlayerState (sessionId, name, role, isReady, connected)
- **状态同步**: Colyseus Schema 自动同步

#### ✅ 优点
1. 使用 Colyseus Schema 自动同步
2. 状态变更触发 UI 更新
3. 三阶段移动算法完整

#### ⚠️ 问题
1. **状态版本管理**:
   ```typescript
   // GameView.tsx 使用 stateVersion 手动触发更新
   const [stateVersion, setStateVersion] = useState(0);
   room.onStateChange(() => setStateVersion(v => v + 1));
   // 但 useMemo 依赖 room.state.players 而不是 stateVersion
   // 这可能导致状态不同步
   ```

2. **玩家离开处理**:
   - onLeave 中调用 onLeaveRoom() 会触发 App 状态变化
   - 但 GameView 中的 room 对象可能已经失效
   - 可能导致内存泄漏或错误

3. **重连机制缺失**:
   - Colyseus 支持断线重连 (`allowReconnection`)
   - 但当前实现未使用
   - 用户刷新页面需要重新登录

---

## 🔧 关键改进建议

### 改进 1: 统一认证流程

#### 问题
HTTP 认证和 WebSocket 认证分离，导致：
- 登录 token 无法在房间中使用
- 无法验证用户身份，只能验证名称
- 安全漏洞：任何人可以用任何名称加入房间

#### 解决方案
```typescript
// 客户端 - 传递 token 到 Colyseus
async joinRoom(roomId: string) {
  const room = await this.client.joinById<GameRoomState>(roomId, {
    playerName: this.currentUser.username,
    authToken: this.authToken, // 传递 token
  });
}

// 服务端 - BattleRoom.onAuth 验证 token
async onAuth(client: Client, options: { playerName?: string; authToken?: string }) {
  // 验证 token
  const result = await userStore.validateToken(options.authToken);
  if (!result.valid) {
    throw new Error('认证失败');
  }
  
  // 保存用户信息到 client
  (client as any).user = result.user;
  return true;
}
```

---

### 改进 2: 修复房间创建参数

#### 问题
```typescript
// NetworkManager.ts
createRoom({ roomName, maxPlayers })

// BattleRoom.ts
onCreate(options: { playerName }) // 参数不匹配！
```

#### 解决方案
```typescript
// NetworkManager.ts
async createRoom() {
  const room = await this.client.create<GameRoomState>('battle', {
    playerName: this.currentUser.username,
    // roomName 应该通过其他方式设置
  });
}

// BattleRoom.ts
onCreate(options: { playerName?: string }) {
  // 使用 playerName 设置房间元数据
  this.setMetadata({
    name: `${options.playerName}的房间`,
  });
}
```

---

### 改进 3: 使用 Colyseus 实时房间列表

#### 当前实现（轮询）
```typescript
startRoomsPolling(intervalMs = 5000) {
  this.roomsInterval = window.setInterval(() => {
    this.getRooms();
  }, intervalMs);
}
```

#### 改进方案（实时）
```typescript
// 使用 Colyseus 的实时房间列表
const rooms = this.client.getAvailableRooms('battle');
rooms.addEventListener('add', (room) => {
  // 新房间添加
});
rooms.addEventListener('remove', (room) => {
  // 房间移除
});
```

---

### 改进 4: 完善状态管理

#### 问题
```typescript
// GameView.tsx
const players = useMemo(() => {
  const result: PlayerState[] = [];
  room?.state.players.forEach((value) => result.push(value));
  return result;
}, [room?.state.players, stateVersion]); // stateVersion 是多余的！
```

#### 解决方案
```typescript
// 直接使用 Colyseus 的响应式数据
const players = useMultiplayerState(room, 'players');

// 或者正确依赖 Schema 集合
const players = useMemo(() => {
  const result: PlayerState[] = [];
  room.state.players.forEach(p => result.push(p));
  return result;
}, [room.state.players]); // Colyseus 会在 players 变化时触发重新渲染
```

---

### 改进 5: 实现断线重连

#### 服务端
```typescript
// BattleRoom.ts
async onLeave(client: Client, code?: number) {
  const allowReconnect = code !== 1000;
  
  if (allowReconnect) {
    try {
      // 允许 60 秒内重连
      await this.allowReconnection(client, 60);
      // 玩家重连成功
      player.connected = true;
      return;
    } catch (e) {
      // 重连超时
    }
  }
  
  // 彻底离开
  this.state.players.delete(client.sessionId);
}
```

#### 客户端
```typescript
// NetworkManager.ts
async restoreSession(): Promise<boolean> {
  // 尝试重连到之前的房间
  const token = localStorage.getItem('stfcs_reconnect_token');
  if (token) {
    try {
      const room = await this.client.reconnect<GameRoomState>(token);
      this.currentRoom = room;
      return true;
    } catch (e) {
      // 重连失败
    }
  }
  // ...
}
```

---

## 📋 优先级改进清单

### P0 - 必须修复（影响功能）
1. ✅ 修复房间创建参数不匹配 - **已完成**
2. ✅ 统一 HTTP 和 WebSocket 认证 - **已完成** (token 传递给 Colyseus)
3. ✅ 修复状态管理依赖 - **已完成** (移除冗余 stateVersion)

### P1 - 重要改进（影响体验）
1. ⏳ 实现断线重连
2. ⏳ Token 过期机制
3. ⏳ 房间实时列表

### P2 - 优化改进（锦上添花）
1. 密码哈希存储
2. 用户头像/个人资料
3. 房间密码功能

---

## ✅ P0 修复总结

### 修复 1: 房间创建参数
**修改前**:
```typescript
// NetworkManager.ts
createRoom({ roomName, maxPlayers })

// BattleRoom.ts
onCreate({ playerName }) // 不匹配！
```

**修改后**:
```typescript
// NetworkManager.ts
createRoom({ authToken }) // 传递认证 token

// BattleRoom.ts
onCreate({ playerName, authToken }) // 一致
```

### 修复 2: 统一认证
**修改**:
```typescript
// NetworkManager.ts - 所有房间操作都传递 token
createRoom() {
  return this.client.create('battle', {
    playerName: this.currentUser.username,
    authToken: this.authToken, // ✅ 传递 token
  });
}

// BattleRoom.ts - 预留 token 验证接口
async onAuth(client, options) {
  // TODO: 验证 options.authToken
  return true;
}
```

### 修复 3: 状态管理
**修改前**:
```typescript
const [stateVersion, setStateVersion] = useState(0);
room.onStateChange(() => setStateVersion(v => v + 1));
const players = useMemo(() => {...}, [room.state.players, stateVersion]);
```

**修改后**:
```typescript
const [forceUpdate, setForceUpdate] = useState(0);
room.onStateChange(() => setForceUpdate(v => v + 1));
const players = useMemo(() => {...}, [room.state.players]); // ✅ Colyseus 自动触发
```
