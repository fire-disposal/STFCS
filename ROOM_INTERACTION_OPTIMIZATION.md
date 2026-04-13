# 房间交互机制优化

## 问题描述

创建新房间时会意外触发重连等待，表现为黑屏等待。原因是客户端调用 `room.leave()` 时没有传递退出代码，服务器端默认 `code !== 1000` 判断为 `true`，触发了 60 秒重连等待。

## 解决方案

### 1. 服务器端优化 (`BattleRoom.ts`)

**退出码规范：**
- `1000`: 正常退出（用户主动离开），立即清理，不允许重连
- `4000`: 请求重连（客户端主动触发重连流程）
- 其他/undefined: 异常断开，尝试自动重连

**优化点：**
- 明确区分三种退出场景
- 对于重连请求，保留玩家数据 60 秒，等待重新加入
- 异常断开时使用 Colyseus 原生 `allowReconnection` 机制
- 所有清理操作统一在 `checkRoomCleanup` 中处理

### 2. 客户端优化 (`NetworkManager.ts`)

**房间切换优化：**
- `leaveCurrentRoomIfNeeded` 改为"尽力而为"模式，不阻塞主要操作
- 创建/加入房间时，异步离开前一个房间
- 传递正确的退出码 `1000` 表示正常退出

**状态管理：**
- 统一清理回调，避免重复代码
- `leaveRoom` 方法直接处理，移除冗余包装
- `dispose` 方法使用正确退出码

### 3. UI 层优化 (`App.tsx`)

**状态切换：**
- 先切换 UI 状态，再异步离开房间
- 避免等待网络请求完成才更新 UI
- 错误处理不阻塞用户操作

## 关键代码变更

### 服务器端 onLeave
```typescript
async onLeave(client: Client, code?: number) {
  const isNormalLeave = code === 1000;
  const isReconnectRequest = code === 4000;

  if (isNormalLeave) {
    // 立即清理
    this.removePlayerSession(client.sessionId);
    this.checkRoomCleanup();
    return;
  }

  if (isReconnectRequest) {
    // 保留数据，等待重连
    player.connected = false;
    setTimeout(() => { /* 超时清理 */ }, 60000);
    return;
  }

  // 异常断开，尝试重连
  await this.allowReconnection(client, 60);
}
```

### 客户端离开房间
```typescript
// 传递 1000 表示正常退出
room.leave(1000);
```

## 测试建议

1. **快速创建多个房间** - 验证不会出现重连等待
2. **正常退出** - 验证立即清理，无延迟
3. **断线重连** - 验证 60 秒内可重连
4. **房间切换** - 验证无黑屏等待

## 相关优化

- 移除 `TurnIndicator` 组件，使用新的 `PhaseBar` 组件
- 移除底部命令 Dock 的 DM 命令按钮（已集成到右侧面板）
- 移除对象创建面板的开关按钮（组件自身支持折叠）
