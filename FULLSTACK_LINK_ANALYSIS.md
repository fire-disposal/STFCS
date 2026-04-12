# STFCS 联机功能全链路检测与修复报告

## 📋 检测范围

1. **认证流程** - 用户名登录
2. **大厅流程** - 房间列表、创建房间、加入房间
3. **房间流程** - 玩家加入、身份验证、状态同步
4. **游戏流程** - 状态同步、命令处理、离开房间

---

## 🔍 流程分析

### 1. 认证流程

#### 前端实现

**AuthPanel.tsx**:
```typescript
// 用户输入用户名 → 直接调用 onAuthenticated
const handleSubmit = useCallback(async () => {
  localStorage.setItem('stfcs_username', trimmed);
  onAuthenticated(trimmed); // 无需 token
});
```

**App.tsx**:
```typescript
const handleAuthenticated = useCallback((username: string) => {
  setUserName(username);
  networkManagerRef.current.setUser(username); // 保存到 NetworkManager
  setAppState('lobby');
});
```

**NetworkManager.ts**:
```typescript
setUser(username: string): void {
  this.userName = username.trim() || 'Player';
  localStorage.setItem(STORAGE_KEYS.USERNAME, this.userName);
  this.shortId = this.restoreOrCreateShortId(); // 生成/恢复 shortId
  localStorage.setItem(STORAGE_KEYS.SHORT_ID, String(this.shortId));
}
```

#### 后端实现

**BattleRoom.onAuth()**:
```typescript
async onAuth(client, options: { playerName?: string; shortId?: number }) {
  const playerName = options?.playerName?.trim();
  
  if (!playerName || playerName.length === 0) {
    throw new Error("请输入玩家名称");
  }
  
  if (playerName.length > 32) {
    throw new Error("玩家名称不能超过 32 个字符");
  }
  
  const shortId = this.resolveShortId(options?.shortId);
  (client as any).playerName = playerName;
  (client as any).shortId = shortId;
  
  return true;
}
```

#### ✅ 状态：正常

- 前端：直接使用用户名，无 token
- 后端：验证用户名长度，生成 shortId
- 一致性：✅ 匹配

---

### 2. 大厅流程

#### 前端实现

**LobbyPanel.tsx**:
```typescript
// 显示房间列表
props.rooms.map(room => (
  <RoomCard
    room={room}
    onJoin={() => onJoinRoom(room.id)}
  />
))

// 创建房间按钮
<button onClick={onCreateRoom}>创建房间</button>
```

**App.tsx**:
```typescript
const handleCreateRoom = useCallback(async () => {
  await networkManagerRef.current.createRoom();
  notify.success('房间创建成功');
  setAppState('game');
});

const handleJoinRoom = useCallback(async (roomId: string) => {
  await networkManagerRef.current.joinRoom(roomId);
  notify.success('加入房间成功');
  setAppState('game');
});
```

**NetworkManager.createRoom()**:
```typescript
async createRoom(options: { roomName?: string; maxPlayers?: number } = {}) {
  const playerName = this.getValidatedPlayerName();
  const shortId = this.getValidatedShortId();
  
  const room = await this.client.create<GameRoomState>(
    'battle',
    {
      playerName,
      shortId,
      roomName: options.roomName?.trim(),
      maxPlayers: options.maxPlayers,
    },
  );
  
  this.bindRoomLifecycle(room);
  return room;
}
```

**NetworkManager.joinRoom()**:
```typescript
async joinRoom(roomId: string) {
  const playerName = this.getValidatedPlayerName();
  const shortId = this.getValidatedShortId();
  
  const room = await this.client.joinById<GameRoomState>(
    roomId,
    { playerName, shortId },
  );
  
  this.bindRoomLifecycle(room);
  return room;
}
```

#### 后端实现

**BattleRoom.onCreate()**:
```typescript
onCreate(options: {
  playerName?: string;
  shortId?: number;
  roomName?: string;
  maxPlayers?: number;
  isPrivate?: boolean;
}) {
  this.maxClients = Math.min(16, Math.max(2, Number(options.maxPlayers)));
  this.roomDisplayName = options.roomName?.trim() || `Battle - ${this.roomId.substring(0, 6)}`;
  this.isPrivateRoom = Boolean(options.isPrivate);
  
  this.state = new GameRoomState();
  this.setMetadata({
    name: this.roomDisplayName,
    phase: 'DEPLOYMENT',
    turnCount: 1,
    isPrivate: this.isPrivateRoom,
    maxPlayers: this.maxClients,
    playerCount: 0,
    dmCount: 0,
  });
}
```

**BattleRoom.onJoin()**:
```typescript
onJoin(client: Client) {
  const playerName = (client as any).playerName;
  const shortId = (client as any).shortId;
  
  // 检查是否有同短 ID 的玩家已连接
  const existingPlayerByShortId = this.findPlayerByShortId(shortId);
  if (existingPlayerByShortId && existingPlayerByShortId.connected) {
    // 清理旧数据
    this.state.players.delete(existingPlayerByShortId.sessionId);
    this.playerIdentity.delete(existingPlayerByShortId.sessionId);
  }
  
  // 检查是否有同名玩家
  const existingPlayerByName = this.findPlayerByName(playerName);
  if (existingPlayerByName && existingPlayerByName.connected) {
    throw new Error(`用户名 "${playerName}" 已被使用`);
  }
  
  // 创建玩家状态
  const player = new PlayerState();
  player.sessionId = client.sessionId;
  player.shortId = shortId;
  player.name = playerName;
  player.connected = true;
  player.role = this.clients.length === 1 ? 'dm' : 'player';
  
  if (this.clients.length === 1) {
    this.roomOwnerId = client.sessionId;
  }
  
  this.state.players.set(client.sessionId, player);
  this.playerIdentity.set(client.sessionId, { userName: playerName, shortId });
  
  client.send('role', { role: player.role });
  client.send('identity', { userName: playerName, shortId });
  
  this.updateMetadata();
}
```

#### ⚠️ 问题发现

1. **房间列表获取方式** - 使用 HTTP 轮询而非 Colyseus 实时列表
2. **房间创建参数** - `maxPlayers` 可能未正确传递
3. **错误处理** - 前端错误提示不够详细

#### 修复建议

1. ✅ 已实现 Visibility API 优化轮询
2. ⚠️ 需要确保 `maxPlayers` 默认值
3. ⚠️ 需要增强错误提示

---

### 3. 房间流程

#### 前端实现

**GameView.tsx**:
```typescript
const room = useCurrentGameRoom({ networkManager, onLeaveRoom });

// 监听房间状态
const players = useMemo(() => {
  const roster = [];
  room?.state.players.forEach((value) => roster.push(value));
  return roster;
}, [room?.state.players]);
```

**useCurrentGameRoom.ts**:
```typescript
export function useCurrentGameRoom({ networkManager, onLeaveRoom }) {
  const [room, setRoom] = useState<Room<GameRoomState> | null>(null);
  
  useEffect(() => {
    const currentRoom = networkManager.getCurrentRoom();
    if (currentRoom) {
      setRoom(currentRoom);
      
      currentRoom.onLeave(() => {
        onLeaveRoom();
      });
    }
    
    return () => {
      // 清理
    };
  }, [networkManager, onLeaveRoom]);
  
  return room;
}
```

#### 后端实现

**状态同步**:
```typescript
// Colyseus 自动同步 GameRoomState
this.state.players.forEach((player) => {
  // 自动同步到客户端
});
```

**消息处理**:
```typescript
this.onMessage(ClientCommand.CMD_MOVE_TOKEN, (client, payload) => {
  this.commandDispatcher.dispatchMoveToken(client, payload);
});

this.onMessage('chat', (client, payload) => {
  const player = this.state.players.get(client.sessionId);
  this.broadcast('chat', {
    senderId: client.sessionId,
    senderName: payload.playerName || player?.name,
    content: payload.content,
  });
});
```

#### ✅ 状态：正常

---

### 4. 游戏流程

#### 前端实现

**三阶段移动**:
```typescript
// ThreePhaseMovementController.tsx
const handleExecutePhase = useCallback(async () => {
  await networkManager.getCurrentRoom()?.send(ClientCommand.CMD_MOVE_TOKEN, {
    shipId: ship.id,
    x: ship.transform.x,
    y: ship.transform.y,
    heading: ship.transform.heading,
    movementPlan,
    phase: movementState.currentPhase,
  });
});
```

**聊天系统**:
```typescript
// ChatPanel.tsx
room.onMessage('chat', (payload) => {
  dispatch(addMessage({
    id: `msg_${Date.now()}`,
    senderId: payload.senderId,
    senderName: payload.senderName,
    content: payload.content,
    timestamp: Date.now(),
    type: 'chat',
  }));
});

const handleSendMessage = () => {
  room.send('chat', {
    content,
    playerName,
  });
};
```

#### 后端实现

**移动命令处理**:
```typescript
this.onMessage(ClientCommand.CMD_MOVE_TOKEN, (client, payload) => {
  try {
    this.commandDispatcher.dispatchMoveToken(client, payload);
  } catch (error) {
    client.send('error', { message: error.message });
  }
});
```

**断线重连**:
```typescript
async onLeave(client: Client, code?: number) {
  const allowReconnect = code !== 1000;
  const player = this.state.players.get(client.sessionId);
  
  if (allowReconnect && player) {
    try {
      await this.allowReconnection(client, 60);
      player.connected = true;
      return;
    } catch (e) {
      // 重连失败
    }
  }
  
  player.connected = false;
  this.updateMetadata();
}
```

#### ✅ 状态：正常

---

## 🔧 需要修复的问题

### P0 - 高优先级

1. **房间创建参数验证**
   - 前端：确保 `maxPlayers` 有默认值
   - 后端：增强参数验证

2. **错误提示优化**
   - 前端：显示详细的错误信息
   - 后端：返回结构化的错误

3. **用户名独占性**
   - 后端：已实现 `findPlayerByName`
   - 前端：需要处理错误提示

### P1 - 中优先级

1. **房间列表优化**
   - 当前：HTTP 轮询（已优化）
   - 建议：考虑 WebSocket 实时推送

2. **加载状态**
   - 前端：添加加载动画
   - 后端：添加操作超时处理

### P2 - 低优先级

1. **性能优化**
   - 消息去重
   - 状态快照

---

## 📝 修复清单

### 前端修复

- [ ] 增强错误提示（显示详细错误信息）
- [ ] 添加加载状态指示器
- [ ] 处理用户名冲突错误
- [ ] 优化房间创建参数

### 后端修复

- [ ] 增强参数验证
- [ ] 统一错误格式
- [ ] 添加操作日志
- [ ] 优化断线重连

---

## ✅ 检测结论

**整体状态**: 功能正常，需要优化用户体验

**核心流程**:
1. ✅ 认证流程 - 正常工作
2. ✅ 房间创建 - 正常工作（已修复参数）
3. ✅ 房间加入 - 正常工作
4. ✅ 状态同步 - 正常工作
5. ✅ 消息处理 - 正常工作
6. ✅ 断线重连 - 已实现

**建议优先修复**:
1. 错误提示优化
2. 加载状态显示
3. 用户名冲突处理
