# 错误弹窗修复说明

日期：2026-04-15

---

## 问题

用户报告：快速点击"创建房间"按钮时，错误弹窗内的文本没了。

---

## 原因分析

原代码在 `activeRoomOperation` 的 Promise 链内部有一个 `.catch()` 块：

```typescript
this.activeRoomOperation = (async () => {
    // ... 创建房间逻辑
})()
    .catch((error: unknown) => {
        console.error("[NetworkManager] Failed to create room:", error);
        
        let errorMessage = "创建房间失败";
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === "string") {
            errorMessage = error;
        }
        
        throw new Error(errorMessage);  // ❌ 这里的错误可能被吞掉
    })
    .finally(() => {
        this.activeRoomOperation = null;
    });

return this.activeRoomOperation;
```

**问题**：
- Promise 链内部的 `.catch()` 重新抛出错误，但外部调用者可能捕获不到
- 当 `activeRoomOperation` 已经存在时，返回的是同一个 Promise，如果这个 Promise 已经处理过错误，可能导致错误消息丢失

---

## 修复方案

### 改进错误处理流程

**修改前**：
```typescript
this.activeRoomOperation = (async () => { ... })()
    .catch((error) => { ... })
    .finally(() => { ... });

return this.activeRoomOperation;
```

**修改后**：
```typescript
// 创建 Promise 但不立即保存引用，这样错误可以正确抛出
const createPromise = (async () => {
    // ... 创建房间逻辑
})();

// 保存引用用于防止并发请求
this.activeRoomOperation = createPromise;

// 等待结果，让错误向上抛出
try {
    return await createPromise;
} finally {
    this.activeRoomOperation = null;
}
```

**优点**：
1. 错误直接向上抛出，不被中间层吞掉
2. `App.tsx` 的 `try-catch` 能正确捕获错误消息
3. `activeRoomOperation` 在 `finally` 中清理，确保状态正确

---

## 错误处理流程

```
用户点击"创建房间"
    ↓
NetworkManager.createRoom()
    ↓
检查 activeRoomOperation 是否存在
    ↓
存在 → 抛出 "一次最多只能创建一个房间"
    ↓
App.tsx catch 捕获
    ↓
提取错误消息：e.message
    ↓
notify.error(errorMsg)
    ↓
显示错误弹窗
```

---

## 测试场景

### 场景 1：快速点击创建房间
1. 快速连续点击"创建新房间"按钮 2-3 次
2. **预期结果**：
   - 第一次点击：开始创建
   - 后续点击：显示错误弹窗 "一次最多只能创建一个房间"

### 场景 2：后端拒绝（已有房间）
1. 用户已有一个房间
2. 再次点击"创建新房间"
3. **预期结果**：显示错误弹窗 "您已经拥有一个房间，请先解散后再创建新房间"

### 场景 3：正常创建
1. 用户在大厅
2. 点击"创建新房间"
3. **预期结果**：
   - 创建成功
   - 显示成功提示 "房间创建成功"
   - 进入游戏界面

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `NetworkManager.ts` | 房间创建逻辑，错误抛出 |
| `App.tsx` | 捕获错误，显示弹窗 |
| `Notification.tsx` | 通知组件，显示错误消息 |

---

## 关键代码

### NetworkManager.ts（错误抛出）
```typescript
if (this.activeRoomOperation) {
    console.warn("[NetworkManager] createRoom: activeRoomOperation pending, ignoring request");
    throw new Error("一次最多只能创建一个房间");
}
```

### App.tsx（错误捕获）
```typescript
try {
    await networkManagerRef.current.createRoom();
    notify.success("房间创建成功");
} catch (e) {
    const errorMsg = e instanceof Error ? e.message : "创建房间失败";
    console.error("[App] Create room error:", e);
    notify.error(errorMsg);  // 显示错误弹窗
}
```

### Notification.tsx（显示消息）
```typescript
error: (message: string, duration?: number) => {
    const notification: Notification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: "error",
        message,  // 错误消息在这里显示
        duration: duration || 10000,
    };
    window.dispatchEvent(new CustomEvent("stfcs-notification", { detail: notification }));
}
```

---

## 验证步骤

1. **编译检查**：
   ```bash
   cd packages/client
   npx tsc --noEmit
   ```
   ✅ 无错误

2. **功能测试**：
   - 启动开发服务器
   - 快速点击"创建房间"按钮
   - 检查错误弹窗是否显示正确消息

3. **控制台日志**：
   - 打开浏览器开发者工具
   - 查看控制台日志
   - 确认错误消息正确传递

---

**修复执行者**：AI Assistant  
**完成时间**：2026-04-15  
**验证状态**：✅ 编译通过，错误处理流程优化
