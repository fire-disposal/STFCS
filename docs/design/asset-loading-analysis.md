# 资源拉取机制与ID体系分析

## 1. 当前资源体系概览

### 1.1 资源类型

| 资源类型 | 用途 | 存储目录 | ID格式 |
|----------|------|----------|--------|
| `avatar` | 玩家头像 | `data/assets/avatars/` | `avatar:{userId}_{ts}_{n}` |
| `ship_texture` | 舰船贴图 | `data/assets/ships/` | `ship_texture:{userId}_{ts}_{n}` |
| `weapon_texture` | 武器贴图 | `data/assets/weapons/` | `weapon_texture:{userId}_{ts}_{n}` |

### 1.2 资产ID格式分析

```
{type}:{ownerId}_{timestamp}_{counter}

示例：
avatar:player_abc_1a2b3c_1
ship_texture:player_xyz_4d5e6f_2
weapon_texture:player_123_7g8h9i_3
```

**问题识别：**

| 问题 | 描述 | 影响 |
|------|------|------|
| ❌ ownerId包含 `player:` 前缀 | ID中存储了语义前缀，实际只有 `player_abc` 有意义 | 解析复杂，冗余 |
| ❌ 无全局唯一性保证 | 时间戳+计数器在同一进程内唯一，多实例可能冲突 | 分布式部署问题 |
| ❌ 无校验机制 | 无法验证ID格式是否正确 | 错误ID导致查询失败 |
| ✓ 类型前缀清晰 | `avatar:`/`ship_texture:`/`weapon_texture:` 直接映射到目录 | 便于解析 |

### 1.3 Schema中的资源引用

```typescript
// TokenSpec 中的贴图引用
texture: TextureSchema.optional()

// TextureSchema 定义
{
  assetId: z.string().optional(),        // ← 资产ID引用
  sourceType: TextureSourceTypeSchema,   // 来源类型（无用）
  source: z.string().optional(),         // URL（无用）
  width: z.number().optional(),          // 尺寸（冗余，资产本身存储）
  height: z.number().optional(),         // 尺寸（冗余）
  offsetX/offsetY/scale: number.optional() // 渲染参数
}

// WeaponSpec 中的贴图引用
texture: TextureSchema.optional()
```

**问题识别：**

| 问题 | 描述 |
|------|------|
| ❌ `sourceType/source` 字段无意义 | 已有资产系统，这两个字段不再需要 |
| ❌ `width/height` 冗余 | 资产元数据已存储尺寸，不需要在Texture中重复 |
| ❌ `assetId` 是 optional | 舰船/武器贴图必须PNG，但assetId可选？逻辑矛盾 |
| ✓ `offsetX/offsetY/scale` 合理 | 渲染参数确实需要在Token/Weapon级别配置 |

---

## 2. 前端资源拉取流程分析

### 2.1 当前流程（问题）

```
┌─────────────────────────────────────────────────────────────────┐
│                     前端拉取流程                                 │
│                                                                  │
│  1. 加入房间 → sync:full → GameRoomState                        │
│                                                                  │
│  2. 解析 GameRoomState.tokens                                   │
│     ┌───────────────────────────────────────────────────────┐   │
│     │  TokenJSON                                              │   │
│     │  ├── token.texture.assetId → 需加载舰船贴图            │   │
│     │  └─────────────────────────────────────────────────┘   │
│     │  ├── mounts[].weapon?.weapon?.texture?.assetId         │   │
│     │      → 需加载武器贴图（逐个遍历）                        │   │
│     └───────────────────────────────────────────────────────┘   │
│                                                                  │
│  3. 逐个调用 asset:get_data                                     │
│     socket.emit("asset:get_data", { assetId })                   │
│     → 返回 base64 + mimeType                                     │
│                                                                  │
│  4. 创建 Image 对象                                              │
│     img.src = `data:${mimeType};base64,${data}`                  │
│                                                                  │
│  问题：                                                          │
│  ❌ 需手动遍历所有Token+Weapon提取assetId                        │
│  ❌ 无批量加载接口，每个资产单独请求                              │
│  ❌ 无预加载机制，渲染时才发现缺失                                │
│  ❌ 无缓存管理，重复请求浪费                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 安全性分析

| 安全点 | 当前状态 | 风险 |
|--------|----------|------|
| 资产全部公开 | ✓ 所有资产无权限限制 | 低风险 - 游戏设计允许 |
| 需登录才能请求 | ✓ asset:get_data 验证 playerId | 低风险 |
| 无资产归属验证 | ✓ 删除时验证 ownerId | 低风险 |
| 无请求频率限制 | ❌ 无rate limit | 中风险 - 可被滥用 |
| 无数据大小限制 | ✓ 上传时限制，拉取无限制 | 低风险 |

---

## 3. 改进方案

### 3.1 统一资源ID格式（推荐）

```typescript
// 新ID格式：全局唯一、简洁、可验证
{type}:{uuid}

示例：
avatar:abc123def456
ship:xyz789ghi012
weapon:jkl345mno678

// 生成逻辑
function generateAssetId(type: AssetType): string {
  const uuid = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
  return `${type}:${uuid}`;
}
```

**优势：**
- 全局唯一（UUID）
- 无冗余前缀（ownerId不嵌入）
- 可解析类型
- 简短易读

### 3.2 精简TextureSchema

```typescript
// 推荐方案
export const TextureSchema = z.object({
  assetId: z.string(),             // 必填，资产ID
  offsetX: z.number().default(0),  // 渲染偏移X
  offsetY: z.number().default(0),  // 渲染偏移Y
  scale: z.number().default(1),    // 渲染缩放
});

// 移除字段：
// - sourceType/source: 已有资产系统
// - width/height: 资产元数据已有
// - transparentColor/transparencyTolerance: 前端处理
```

### 3.3 批量资源加载接口

```typescript
// 新增接口
"asset:batch_get": {
  assetIds: string[];  // 最多50个
}

// 响应
{
  assets: Record<assetId, {
    data: string;      // base64
    mimeType: string;
    width: number;
    height: number;
  }>;
  missing: string[];  // 未找到的ID
}
```

### 3.4 房间资源预加载

```typescript
// sync:full 增强响应
{
  state: GameRoomState,
  preloadAssets: string[];  // 所有需要预加载的assetId列表
}

// 或单独接口
"room:get_assets": {
  roomId: string;
}

// 响应
{
  assetIds: {
    shipTextures: string[];
    weaponTextures: string[];
    avatars: string[];
  };
}
```

### 3.5 前端缓存机制

```typescript
class AssetCache {
  private cache = new Map<string, {
    image: HTMLImageElement;
    metadata: { width, height, mimeType };
    loadedAt: number;
  }>();
  
  private loading = new Map<string, Promise<HTMLImageElement>>();
  
  // 批量预加载
  async preload(assetIds: string[]): Promise<void> {
    const toLoad = assetIds.filter(id => !this.cache.has(id));
    if (toLoad.length === 0) return;
    
    const response = await socket.emit("asset:batch_get", { assetIds: toLoad });
    
    for (const [id, data] of Object.entries(response.assets)) {
      const img = new Image();
      img.src = `data:${data.mimeType};base64,${data.data}`;
      await new Promise(r => img.onload = r);
      
      this.cache.set(id, {
        image: img,
        metadata: { width: data.width, height: data.height, mimeType: data.mimeType },
        loadedAt: Date.now(),
      });
    }
  }
  
  // 获取已加载的资源
  get(assetId: string): HTMLImageElement | null {
    return this.cache.get(assetId)?.image ?? null;
  }
  
  // 清理旧缓存
  cleanup(maxAgeMs: number = 300000): void {
    const now = Date.now();
    for (const [id, entry] of this.cache.entries()) {
      if (now - entry.loadedAt > maxAgeMs) {
        this.cache.delete(id);
      }
    }
  }
}
```

---

## 4. 统一资源加载流程

### 4.1 推荐流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     统一资源加载流程                             │
│                                                                  │
│  1. 加入房间                                                     │
│     socket.emit("room:join", { roomId })                         │
│     → sync:full                                                  │
│     → room:get_assets (新增)                                     │
│                                                                  │
│  2. 解析资产列表                                                  │
│     response.assetIds = {                                        │
│       shipTextures: ["ship:abc123", "ship:def456"],              │
│       weaponTextures: ["weapon:xyz789", ...],                    │
│       avatars: ["avatar:ghi012", ...]                            │
│     }                                                             │
│                                                                  │
│  3. 批量预加载                                                    │
│     assetCache.preload(allAssetIds)                              │
│     → socket.emit("asset:batch_get", { assetIds })               │
│     → 解析base64 → Image对象 → 缓存                               │
│                                                                  │
│  4. 渲染时直接取缓存                                              │
│     const texture = assetCache.get(assetId)                      │
│     → 立即可用，无延迟                                            │
│                                                                  │
│  5. 动态资产处理                                                  │
│     sync:delta → token_add → 提取assetId                         │
│     → assetCache.preload([newAssetId])                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 安全保障

```typescript
// 后端验证逻辑
async function handleAssetBatchGet(
  socket: Socket,
  requestId: string,
  payload: { assetIds: string[] }
): Promise<void> {
  // 1. 登录验证
  if (!socket.data.playerId) {
    return sendResponse(socket, requestId, false, undefined, { 
      code: "NOT_AUTHED" 
    });
  }

  // 2. 数量限制
  if (payload.assetIds.length > 50) {
    return sendResponse(socket, requestId, false, undefined, { 
      code: "TOO_MANY_ASSETS",
      message: "Maximum 50 assets per request"
    });
  }

  // 3. ID格式验证
  for (const id of payload.assetIds) {
    if (!isValidAssetId(id)) {
      return sendResponse(socket, requestId, false, undefined, { 
        code: "INVALID_ASSET_ID",
        message: `Invalid asset ID format: ${id}`
      });
    }
  }

  // 4. 批量获取
  const assets: Record<string, any> = {};
  const missing: string[] = [];

  for (const assetId of payload.assetIds) {
    const data = await assetService.getAssetData(assetId);
    const info = await assetService.getAssetInfo(assetId);

    if (data && info) {
      assets[assetId] = {
        data: data.toString("base64"),
        mimeType: info.mimeType,
        width: info.metadata?.width,
        height: info.metadata?.height,
      };
    } else {
      missing.push(assetId);
    }
  }

  sendResponse(socket, requestId, true, { assets, missing });
}

// ID格式验证
function isValidAssetId(id: string): boolean {
  const match = id.match(/^(avatar|ship_texture|weapon_texture):[a-f0-9]{12}$/);
  return match !== null;
}
```

---

## 5. Schema与ID体系结合建议

### 5.1 当前结合程度评估

| 结合点 | 评分 | 问题 |
|--------|------|------|
| assetId引用 | ⭐⭐⭐ | optional导致可能缺失 |
| 类型映射 | ⭐⭐⭐⭐ | assetId前缀直接映射目录 |
| 元数据冗余 | ⭐⭐ | width/height重复存储 |
| 无效字段 | ⭐ | sourceType/source无用 |

### 5.2 推荐改进

```typescript
// TokenSpec 简化
export const TokenSpecSchema = z.object({
  // ... 其他字段
  texture: z.object({
    assetId: z.string(),          // 必填！舰船必须有贴图
    offsetX: z.number().default(0),
    offsetY: z.number().default(0),
    scale: z.number().default(1),
  }).optional(),                   // 整体可选（预设舰船可能有默认贴图）
});

// WeaponSpec 简化
export const WeaponSpecSchema = z.object({
  // ... 其他字段
  texture: z.object({
    assetId: z.string(),          // 必填！武器必须有贴图
    offsetX: z.number().default(0),
    offsetY: z.number().default(0),
    scale: z.number().default(1),
  }).optional(),
});

// 资产引用完整性检查
function validateTokenTextures(tokenJson: TokenJSON): ValidationResult {
  const errors: string[] = [];

  // 舰船贴图
  if (!tokenJson.token.texture?.assetId) {
    errors.push("Token missing texture.assetId");
  }

  // 武器贴图
  for (const mount of tokenJson.token.mounts ?? []) {
    if (mount.weapon && typeof mount.weapon === "object") {
      if (!mount.weapon.weapon?.texture?.assetId) {
        errors.push(`Weapon ${mount.id} missing texture.assetId`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## 6. 最终方案总结

### 6.1 ID体系改进

```
旧格式: avatar:player_abc_1a2b3c_1
新格式: avatar:abc123def456

改进：
- UUID全局唯一
- 移除player:前缀冗余
- 12字符短ID
- 可验证格式
```

### 6.2 Schema改进

```typescript
TextureSchema {
  assetId: string,     // 必填
  offsetX: number,     // 渲染偏移
  offsetY: number,
  scale: number,
}
// 移除: sourceType, source, width, height, transparentColor
```

### 6.3 接口改进

| 新增接口 | 用途 |
|----------|------|
| `room:get_assets` | 获取房间所需资产ID列表 |
| `asset:batch_get` | 批量加载资产数据 |

### 6.4 前端流程

```
加入房间 → 获取资产列表 → 批量预加载 → 缓存 → 渲染时直接使用
```

### 6.5 安全保障

- 登录验证
- ID格式校验
- 批量数量限制（≤50）
- Rate limit（可选）