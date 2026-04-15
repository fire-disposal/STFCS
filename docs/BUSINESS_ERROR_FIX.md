# 后端业务提示优化报告

日期：2026-04-15  
状态：✅ 已完成

---

## 问题

后端日志中出现令人不安的错误信息：

```
server:dev: Error: 您已经拥有一个房间，请先解散后再创建新房间
server:dev:     at _BattleRoom.onJoin (...)
```

**问题本质**：
- 这是一个正常的业务逻辑提示，不是真正的错误
- 用户快速点击"创建房间"时触发
- 前端需要红色错误弹窗提示用户
- 后端不应该将其作为错误日志输出

---

## 修复方案

### ✅ 后端优化（BattleRoom.ts）

**修改前**：
```typescript
if (alreadyOwns) {
    // 先清理当前房间，再抛出错误
    this.disconnect();
    throw new Error("您已经拥有一个房间，请先解散后再创建新房间");
}
```

**修改后**：
```typescript
if (alreadyOwns) {
    // 业务提示：用户已拥有其他房间，拒绝加入并发送提示消息
    client.send("error", { message: "您已经拥有一个房间，请先解散后再创建新房间" });
    // 正常断开连接，不抛出错误
    client.leave();
    return;
}
```

**改进**：
- ✅ 不再抛出错误，避免服务器日志污染
- ✅ 通过 WebSocket 发送业务消息给客户端
- ✅ 正常断开连接，符合业务逻辑

---

### ✅ 前端监听（NetworkManager.ts）

**新增**：监听后端发送的业务错误消息

```typescript
// 监听错误消息（业务提示，非真正错误）
room.onMessage("error", (payload: { message: string }) => {
    console.log("[NetworkManager] Business error message:", payload.message);
    // 将错误消息通过事件抛出，让上层处理
    window.dispatchEvent(new CustomEvent("stfcs-room-error", { detail: payload.message }));
});
```

---

### ✅ 前端显示（App.tsx）

**新增**：监听业务错误事件并显示弹窗

```typescript
// 监听业务错误消息（如：已拥有房间）
useEffect(() => {
    const handleBusinessError = (event: CustomEvent<string>) => {
        console.log("[App] Business error received:", event.detail);
        notify.error(event.detail);
    };

    window.addEventListener("stfcs-room-error", handleBusinessError as EventListener);

    return () => {
        window.removeEventListener("stfcs-room-error", handleBusinessError as EventListener);
    };
}, []);
```

---

### ✅ 前端并发提示优化（NetworkManager.ts）

**修改前**：
```typescript
if (this.activeRoomOperation) {
    throw new Error("一次最多只能创建一个房间");
}
```

**修改后**：
```typescript
if (this.activeRoomOperation) {
    console.warn("[NetworkManager] createRoom: activeRoomOperation pending");
    // 静默忽略，后端会处理重复创建的情况
    throw new Error("正在处理中，请稍候");
}
```

**改进**：
- ✅ 提示更友好："正在处理中，请稍候"
- ✅ 主要业务判断交给后端处理
- ✅ 前端只做并发控制，不重复业务逻辑

---

## 消息流程

### 正常创建流程
```
前端：createRoom()
    ↓
后端：onCreate() → onJoin()
    ↓
后端：检查通过，允许加入
    ↓
前端：收到房间对象
    ↓
前端：notify.success("房间创建成功")
```

### 重复创建流程
```
前端：快速点击创建房间
    ↓
前端：activeRoomOperation 存在 → 提示"正在处理中，请稍候"
    
或：
    ↓
后端：onJoin() 检测到已有房间
    ↓
后端：client.send("error", { message: "您已经拥有一个房间..." })
后端：client.leave()  // 正常断开
    ↓
前端：收到 "error" 消息
    ↓
前端：dispatchEvent("stfcs-room-error")
    ↓
App.tsx：notify.error("您已经拥有一个房间，请先解散后再创建新房间")
```

---

## 日志对比

### 修复前
```
server:dev: Error: 您已经拥有一个房间，请先解散后再创建新房间
server:dev:     at _BattleRoom.onJoin (D:\repo\dev\STFCS\packages\server\src\rooms\BattleRoom.ts:88:11)
server:dev:     at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
```

### 修复后
```
[NetworkManager] Business error message: 您已经拥有一个房间，请先解散后再创建新房间
[App] Business error received: 您已经拥有一个房间，请先解散后再创建新房间
```

---

## 用户体验

### 修复前
- ❌ 服务器日志显示错误堆栈
- ❌ 用户看到红色错误弹窗（正确）

### 修复后
- ✅ 服务器日志清晰，只有业务消息
- ✅ 用户看到红色错误弹窗（正确）
- ✅ 前端提示："正在处理中，请稍候"（友好）
- ✅ 后端提示："您已经拥有一个房间，请先解散后再创建新房间"（清晰）

---

## 文件修改

| 文件 | 修改内容 | 行数变化 |
|------|---------|---------|
| `server/src/rooms/BattleRoom.ts` | 改为发送业务消息，不抛出错误 | +2 |
| `client/src/network/NetworkManager.ts` | 监听 "error" 消息并转发 | +7 |
| `client/src/App.tsx` | 监听业务错误事件并显示弹窗 | +13 |

---

## 测试场景

### 场景 1：快速点击创建房间
1. 快速连续点击"创建新房间"按钮 2-3 次
2. **预期结果**：
   - 第一次：显示"正在处理中，请稍候"
   - 后续点击：显示"正在处理中，请稍候"

### 场景 2：已拥有房间时创建
1. 用户已有一个房间（未解散）
2. 再次点击"创建新房间"
3. **预期结果**：
   - 显示红色错误弹窗："您已经拥有一个房间，请先解散后再创建新房间"
   - 服务器日志无错误堆栈

### 场景 3：正常创建
1. 用户在大厅，没有房间
2. 点击"创建新房间"
3. **预期结果**：
   - 创建成功
   - 显示成功提示
   - 进入游戏界面

---

## 服务器日志验证

启动开发服务器后，重复创建房间：

**预期日志**：
```
[NetworkManager] Business error message: 您已经拥有一个房间，请先解散后再创建新房间
[App] Business error received: 您已经拥有一个房间，请先解散后再创建新房间
```

**不应出现**：
```
Error: 您已经拥有一个房间...
at _BattleRoom.onJoin...
```

---

## 设计原则

### 1. 业务逻辑后置
- 主要的业务判断在后端处理
- 前端只做基础的并发控制和验证

### 2. 错误分类清晰
- **业务提示**：通过消息发送，不记录为错误日志
- **真正错误**：抛出异常，记录堆栈

### 3. 用户体验优先
- 前端提示简洁友好："正在处理中，请稍候"
- 后端提示清晰明确："您已经拥有一个房间，请先解散后再创建新房间"

---

**修复执行者**：AI Assistant  
**完成时间**：2026-04-15  
**验证状态**：✅ 编译通过，日志优化完成
