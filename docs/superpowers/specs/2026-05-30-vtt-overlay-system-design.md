# VTT 覆盖层系统设计

## 概述

为 STFCS 单房间战术战斗添加虚拟桌面（VTT）覆盖层功能：实时光标共享、地图 Ping 信标、绘图系统（画笔+直线+箭头）、文字标注、摄像头视口指示器。覆盖层数据仅存内存，不参与 GameRoomState 持久化。

## 子功能

| 功能 | 说明 | 可靠性 | 持久化 |
|------|------|--------|--------|
| 光标共享 | 所有玩家看到彼此鼠标世界坐标位置 | volatile | 无 |
| Ping 信标 | 点击地图发出短暂脉冲标记（3s TTL） | 可靠 | 无 |
| 绘图系统 | 自由画笔 + 直线 + 箭头，实时流式同步 | 流式 volatile / commit 可靠 | 内存 |
| 文字标注 | 地图上放置文字标签，可移动/删除 | 可靠 | 内存 |
| 摄像头视口 | 其他玩家相机四角 L 形矩形框，含位置/缩放/旋转 | volatile | 内存 |

## 架构

```
Client ── sock.emit("overlay_send", { roomId, type, payload }) ──→ Server
Server ── relay to room (except sender) ──→ Client
```

覆盖层走独立 Socket.IO 事件 `"overlay_send"` / `"overlay_push"`，与 `GameRoomState` / JSON Patch / `MutativeStateManager` 完全解耦。服务端仅做中继 + 内存缓存。

### 三层关系

```
data/    OverlaySchemas.ts — 共享类型定义（消息载荷、缓存对象）
server/  OverlayRelay      — 纯中继器 + 内存缓存（OverlayStateCache）
client/  OverlayClient     — 前后端通信 + 节流
         overlay 层        — PixiJS zIndex=6 渲染层
         OverlayToolbar    — 工具选择 UI 面板
```

## 数据模型（OverlaySchemas.ts）

### 消息载荷类型

```typescript
export const CursorPayloadSchema = z.object({
  playerId: z.string(),
  x: z.number(), y: z.number(),
  color: z.string(),
});

export const PingPayloadSchema = z.object({
  pingId: z.string(),
  playerId: z.string(),
  x: z.number(), y: z.number(),
  color: z.string(),
});

export const DrawStreamPayloadSchema = z.object({
  strokeId: z.string(),
  playerId: z.string(),
  x: z.number(), y: z.number(),
  color: z.string(),
  lineWidth: z.number(),
});

export const DrawToolSchema = z.enum(["pen", "line", "arrow"]);
export const DrawCommitPayloadSchema = z.object({
  strokeId: z.string(),
  playerId: z.string(),
  tool: DrawToolSchema,
  color: z.string(),
  lineWidth: z.number(),
  points: z.array(z.object({ x: z.number(), y: z.number() })),
});

export const NoteOpSchema = z.enum(["create", "move", "delete"]);
export const NotePayloadSchema = z.object({
  op: NoteOpSchema,
  id: z.string(),
  playerId: z.string(),
  x: z.number(), y: z.number(),
  text: z.string().optional(),
  color: z.string(),
});

export const ViewportPayloadSchema = z.object({
  playerId: z.string(),
  cx: z.number(), cy: z.number(),
  zoom: z.number(),
  rotation: z.number(),
  sw: z.number(), sh: z.number(),
  color: z.string(),
});

export const ClearScopeSchema = z.enum(["all", "player"]);
export const ClearPayloadSchema = z.object({
  scope: ClearScopeSchema,
  targetId: z.string().optional(),
});

export const OverlayMessageSchema = z.object({
  roomId: z.string(),
  type: z.enum(["cursor", "ping", "draw_stream", "draw_commit", "note", "viewport", "clear"]),
  payload: z.unknown(),
});

export const OverlaySyncPayloadSchema = z.object({
  drawings: z.array(DrawCommitPayloadSchema),
  notes: z.array(NotePayloadSchema),
  viewports: z.array(ViewportPayloadSchema),
  pings: z.array(PingPayloadSchema),
});
```

### 服务端缓存

```typescript
class OverlayStateCache {
  drawings: Map<string, DrawCommitPayload>;  // strokeId → shape
  notes: Map<string, NotePayload>;           // noteId → annotation
  viewports: Map<string, ViewportPayload>;   // playerId → viewport (latest only)
  pings: Map<string, PingPayload>;           // pingId → ping (TTL 3s auto-remove)
}
```

## 服务端（OverlayRelay）

```
packages/server/src/server/socketio/overlay.ts
```

- 每个房间持有一个 `OverlayStateCache`
- 监听 `"overlay_send"` 事件，`handle(roomId, senderId, type, payload)`
- volatile 转发：cursor、draw_stream、viewport（丢包不重发）
- 可靠转发：ping、draw_commit、note、clear
- ping 发后 3 秒自动广播移除
- `getSyncPayload(roomId)`：新人加入时全量推送当前覆盖层缓存
- `removeRoom(roomId)`：房间销毁时清理缓存
- 在 `handlers.ts` 中注册 `socket.on("overlay_send", ...)`，不走 `RpcRegistry`

## 客户端——渲染层

### PixiJS 层级（useLayerSystem.ts 新增）

```
world
├── zIndex 4 grid
├── zIndex 5 cursor (本地光标)
├── zIndex 6 overlay          ← 新增
│   ├── viewportRects         (远程摄像头视口)
│   ├── drawings              (绘图笔迹/形状)
│   ├── remoteCursors         (远程玩家光标)
│   ├── notes                 (文字标注)
│   └── pings                 (Ping 脉冲动画)
├── zIndex 7 tacticalTokens
├── zIndex 8-14 ...
```

### 渲染器（client/src/renderer/overlays/）

| 文件 | 说明 |
|------|------|
| DrawingRenderer.ts | 收到 draw_stream → appendPoint 增量绘制；收到 draw_commit → 最终形状，清空 stream 缓存 |
| RemoteCursorRenderer.ts | 其他玩家光标三角箭头 + 小昵称标签，颜色为该玩家色 |
| PingRenderer.ts | 脉冲圆环（2 帧：实心圆 → 扩展空心圆 → 淡出），3 秒生命周期 |
| NoteRenderer.ts | PixiJS Text 对象，世界坐标渲染，可拖拽移动 |
| ViewportRenderer.ts | 四个 L 形角标（8px 短线），颜色=该玩家色，透明度 0.6 |

### 玩家颜色分配

固定色轮（8色），按 join 顺序分配：
```
#FF6B6B #4ECDC4 #45B7D1 #96CEB4 #FFEAA7 #DDA0DD #98D8C8 #F7DC6F
```
DM 固定金色 `#FFD700`。

## 客户端——OverlayClient

```
client/src/network/OverlayClient.ts
```

- 封装 `socket.emit("overlay_send", ...)` 调用
- 内部节流：cursor=50ms, draw_stream=20ms, viewport=200ms
- 监听 `"overlay_push"` → 回调渲染器推送
- 监听 `"overlay_sync"` → 全量同步新人
- brushThrottleMap 按 strokeId 独立限流（多笔同时画互不影响）

## 客户端——UI

### OverlayToolbar

```
client/src/ui/panels/OverlayToolbar.tsx
```

画布左上角水平按钮组。快捷键：D=画笔, A=箭头, P=Ping, T=标注, Esc=退出。

### uiStore 新增

```typescript
overlayMode: "none" | "pen" | "arrow" | "ping" | "note";
overlayColor: string;
// overlayTool is derived from overlayMode
```

当 `overlayMode !== "none"` 时：
- 左键拖拽不触发相机平移（被覆盖层模式拦截）
- `usePixiApp.ts` 的 handleInit 中检查 overlayMode 决定是否走绘图逻辑
- 右键/中键相机操作不受影响

## 交互流程

### 画笔
1. 按下 → `sendDrawStream()` 节流广播流式点（volatile）
2. 拖拽 → 本地即时渲染 + 持续广播
3. 松开 → `sendDrawCommit()` 全部点（可靠），服务端缓存

### 箭头/直线
1. 点击起点 → 本地高亮起点圆点
2. 移动 → 实时预览（本地 only，不广播）
3. 点击终点 → commit 两点线段，带箭头三角形（arrow 模式）

### Ping
- 单击 → 立即发 ping（可靠），服务端 3s TTL

### 标注
- 点击 → HUD 层浮动输入框
- Enter → commit 文字
- 拖拽 → move → 广播

### 摄像头视口
- 本地相机变化时节流发送 → 收到远程视口数据 → 渲染四角 L 形框

### DM 清除
- "全部" → clear all caches + 广播 clear(type=all)
- "某玩家" → clear player's drawings/notes + 广播

## 文件清单

| 包 | 文件 | 操作 |
|-----|------|------|
| data | `src/core/OverlaySchemas.ts` | 新建 |
| data | `src/core/index.ts` | 修改（添加 export） |
| server | `src/server/socketio/overlay.ts` | 新建 |
| server | `src/server/socketio/handlers.ts` | 修改（注册 overlay_send） |
| server | `src/server/socketio/handlers/services.ts` | 修改（提供 OverlayRelay 实例） |
| client | `src/network/OverlayClient.ts` | 新建 |
| client | `src/renderer/core/useLayerSystem.ts` | 修改（添加 overlay 层） |
| client | `src/renderer/core/usePixiApp.ts` | 修改（创建层 + overlay 模式鼠标） |
| client | `src/renderer/core/PixiCanvas.tsx` | 修改（集成 overlay 渲染器） |
| client | `src/renderer/overlays/DrawingRenderer.ts` | 新建 |
| client | `src/renderer/overlays/RemoteCursorRenderer.ts` | 新建 |
| client | `src/renderer/overlays/PingRenderer.ts` | 新建 |
| client | `src/renderer/overlays/NoteRenderer.ts` | 新建 |
| client | `src/renderer/overlays/ViewportRenderer.ts` | 新建 |
| client | `src/renderer/overlays/index.ts` | 新建（桶导出） |
| client | `src/ui/panels/OverlayToolbar.tsx` | 新建 |
| client | `src/state/stores/uiStore.ts` | 修改（overlayMode/overlayColor） |
| client | `src/pages/GamePage.tsx` | 修改（集成 OverlayClient + 工具栏） |

## 玩家颜色分配

```typescript
export const PLAYER_OVERLAY_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
];
export const DM_OVERLAY_COLOR = "#FFD700";
```

按玩家连接顺序分配（不受重连或离开影响）。服务端在玩家首次发送覆盖层消息时分配颜色并缓存。
