# 贴图渲染系统优化设计

日期：2026-06-11
方案：混合模式（HTTP 下载 + Socket.IO 管理）

## 背景

当前所有贴图（舰船、武器、旗标）通过 Socket.IO 以 base64 编码传输。这导致 33% 带宽开销、Socket 通道阻塞、无浏览器缓存，以及客户端纹理缓存绑定组件生命周期导致频繁重加载。此外存在武器贴图偏移旋转 Bug 和代码一致性问题。

## 当前问题清单

### 传输层
1. 所有贴图通过 Socket.IO base64 传输，无 HTTP 端点
2. 每次加入/重渲染全量重新获取，无缓存头/ETag
3. base64 编码使 2MB 文件变为 ~2.66MB

### 服务端
4. `batchGetAssets` 串行读取磁盘（逐个 metadata + data）
5. 无内存缓存，每次请求读文件系统
6. `room:get_assets` 默认不含 data，未被客户端实际用于预加载

### 客户端
7. `useTextureLoader` 用 `assetIds.join(",")` 作为 useEffect 依赖，不稳定
8. 10s 超时对大批量不够
9. 组件卸载时 `Assets.unload` 销毁所有纹理，React StrictMode 或路由切换导致重新获取
10. 多组件独立请求，无共享缓存
11. 无加载状态/失败反馈

### 渲染层
12. 武器贴图偏移未按 mount facing 旋转（`WeaponTextureRenderer.ts:71-72`）
13. `ShipTextureRenderer` 内联计算 heading 弧度，未使用 `toPixiRotation`

## 设计

### Section 1：服务端 HTTP 资产端点

#### HTTP 路由

```
GET /api/assets/:assetId
```

行为：
1. 从 assetId 解析类型（`ship_texture:xxx` → `ships/`）
2. 查 LRU 缓存，命中则直接返回
3. 未命中则读磁盘元数据获取 mimeType，读二进制文件
4. 写入 LRU 缓存
5. 返回原始二进制 + 响应头

响应头：
```
Content-Type: image/png
Cache-Control: public, max-age=31536000, immutable
ETag: "<assetId>"
```

资产不可变（上传后不修改），所以用 immutable + 1年 max-age。ETag 用 assetId 本身。

#### 服务端 LRU 内存缓存

在 `AssetService` 中添加 LRU 缓存：

```typescript
interface CacheEntry {
  buffer: Buffer;
  mimeType: string;
  lastAccess: number;
}

class AssetCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 50 * 1024 * 1024; // 50MB
  private currentSize = 0;
}
```

- 容量限制 50MB（约 25 张舰船贴图）
- 仅缓存二进制数据
- LRU 淘汰策略：超出容量时移除最久未访问的条目
- `batchGetAssets` 也从此缓存受益

#### 改动文件
- `packages/server/src/index.ts` — 在 `handleHttpRequest` 中添加 `/api/assets/` 路由
- `packages/server/src/services/AssetService.ts` — 添加 `getAssetBuffer(assetId)` 方法 + LRU 缓存

### Section 2：客户端全局 TextureManager 单例

#### TextureManager 设计

独立于 React 组件生命周期的全局单例：

```typescript
interface TextureEntry {
  texture: Texture | null;
  status: "loading" | "loaded" | "failed";
  retryCount: number;
  lastAttemptAt: number;
}

class TextureManager {
  private cache: Map<string, TextureEntry>;
  private loading: Set<string>;
  private listeners: Set<() => void>;

  getTextureUrl(assetId: string): string;       // "/api/assets/{assetId}"
  async load(assetIds: string[]): Promise<void>; // 批量预加载
  getTexture(assetId: string): Texture | null;   // 同步获取
  getStatus(assetId: string): "none" | "loading" | "loaded" | "failed";
  getLoadingProgress(): { loaded: number; total: number };
  subscribe(listener: () => void): () => void;   // 状态变更通知
}

export const textureManager = new TextureManager();
```

加载流程：
```
PixiCanvas → collectAssetIds → textureManager.load(ids)
                                     ↓
                              Assets.load("/api/assets/{assetId}")
                                     ↓
                              浏览器 HTTP 请求（自动缓存）
                                     ↓
                              PixiJS Texture 存入 cache
                                     ↓
                              notify listeners → React 重渲染
```

关键特性：
- 缓存脱离组件生命周期，SPA 全局存活
- 多组件请求同一 assetId 只触发一次加载
- 重试逻辑：3 次，2s 间隔
- 不做 `Assets.unload`（纹理在内存中保留直到页面卸载）

#### useTextureLoader 重构为薄 Hook

```typescript
function useTextureLoader(assetIds: string[]): TextureCache {
  // 1. 调用 textureManager.load(assetIds)
  // 2. useSyncExternalStore 订阅 textureManager 变更
  // 3. 返回当前已加载的纹理 Map
  // 4. 不做任何 Assets.unload
}
```

#### 改动文件
- 新增 `packages/client/src/renderer/systems/TextureManager.ts`
- 重构 `packages/client/src/renderer/systems/useTextureLoader.ts`
- 简化 `packages/client/src/renderer/core/PixiCanvas.tsx` — 移除 `fetchAssets` prop
- 简化 `packages/client/src/pages/GamePage.tsx` — 不再传 `fetchAssets`

### Section 3：渲染层 Bug 修复

#### 3a. 武器贴图偏移旋转修复

文件：`packages/client/src/renderer/entities/WeaponTextureRenderer.ts`

修复前：
```typescript
const worldX = mountWorldPos.x - weaponOffsetX;
const worldY = mountWorldPos.y - weaponOffsetY;
```

修复后：
```typescript
const totalHeading = ship.runtime.heading + mountFacing;
const totalRad = toPixiRotation(totalHeading);
const worldX = mountWorldPos.x - weaponOffsetX * Math.cos(totalRad) + weaponOffsetY * Math.sin(totalRad);
const worldY = mountWorldPos.y - weaponOffsetX * Math.sin(totalRad) - weaponOffsetY * Math.cos(totalRad);
```

#### 3b. 统一 toPixiRotation

文件：`packages/client/src/renderer/entities/ShipTextureRenderer.ts`

修复前：
```typescript
const headingRad = (ship.runtime.heading * Math.PI) / 180;
```

修复后：
```typescript
const headingRad = toPixiRotation(ship.runtime.heading);
```

#### 3c. 加载状态 UI

TextureManager 暴露 `getLoadingProgress()` 返回 `{ loaded, total }`。

PixiCanvas 在画布角落渲染加载指示器：
- loading 状态：显示 "加载贴图 (3/7)..." 小文字（PixiJS Text 在 HUD 层）
- 全部加载完成后自动隐藏
- 不用 toast/弹窗，避免打扰游戏流程

### Section 4：接口清理与向后兼容

#### Socket.IO 接口保留但降级

保留（不删除）：
- `asset:upload` — 上传仍走 Socket.IO
- `asset:action` (list/delete) — 管理操作不变
- `asset:action` (batch_get) — 保留作降级通道，客户端默认不再调用

移除的依赖：
- `GameCanvas.fetchAssets` prop
- `GamePage` 中 `assetSocket.batchGet` 传入 PixiCanvas 的链路

#### room:get_assets 重新定位

改为仅返回 assetId 列表（不含 data），作为"预热提示"：
```
客户端加入房间 → 收到 assetId 列表 → textureManager.load(assetIds) → HTTP 预加载
```

#### UI 组件预览改用 HTTP

`LoadoutCustomizerDialog`、`FactionSelector`、`FactionCustomizerDialog` 中的预览图改为：
```html
<img src="/api/assets/{assetId}" />
```
不再需要 batchGet + base64 → dataUrl 转换。

`useAssetSocket` 仅用于 upload/list/delete 操作。

### Section 5：开发环境跨域处理

开发模式下 Vite 在 5173，服务端在 3001，`/api/assets/` 相对 URL 无法到达服务端。

方案：在 `vite.config.ts` 添加代理：
```typescript
server: {
  proxy: {
    "/api": "http://localhost:3001"
  }
}
```

这样 TextureManager 和 `<img>` 统一使用相对路径 `/api/assets/{id}`，无需考虑跨域。
生产环境同源部署，无需额外处理。

### Section 6：缓存一致性

- 资产删除时，服务端 LRU 缓存同步移除对应条目（在 `deleteAsset` 中调用 `cache.evict(assetId)`）
- HTTP 端点对不存在的 assetId 返回 404 + `Cache-Control: no-store`（避免浏览器缓存 404 响应）
- 客户端 TextureManager 遇到 HTTP 404 时标记为 `failed`，不重试

## 改动文件汇总

| 改动 | 文件 | 类型 |
|------|------|------|
| HTTP 资产端点 | `packages/server/src/index.ts` | 新增路由 |
| LRU 内存缓存 + getAssetBuffer | `packages/server/src/services/AssetService.ts` | 增强 |
| TextureManager 单例 | `packages/client/src/renderer/systems/TextureManager.ts` | 新增 |
| useTextureLoader 重构 | `packages/client/src/renderer/systems/useTextureLoader.ts` | 重构 |
| PixiCanvas 简化 | `packages/client/src/renderer/core/PixiCanvas.tsx` | 简化 |
| GamePage 简化 | `packages/client/src/pages/GamePage.tsx` | 简化 |
| 武器偏移 Bug | `packages/client/src/renderer/entities/WeaponTextureRenderer.ts` | 修复 |
| 统一 toPixiRotation | `packages/client/src/renderer/entities/ShipTextureRenderer.ts` | 修复 |
| 加载状态指示 | `packages/client/src/renderer/core/PixiCanvas.tsx` | 增强 |
| 预览改 img src | `LoadoutCustomizerDialog`, `FactionSelector` 等 | 优化 |
| room:get_assets 简化 | `packages/server/src/server/socketio/handlers/room.ts` | 简化 |
| Vite 代理配置 | `packages/client/vite.config.ts` | 增强 |
