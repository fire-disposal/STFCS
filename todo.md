## 舰船贴图渲染系统 ✅ 已实现

### 架构设计

```
贴图渲染管线：
├── collectAssetIds(ships) → 收集所有 assetId
├── useTextureLoader(assetIds, fetchAssets) → TextureCache
│   └── Assets.load(dataUrl) → PixiJS Texture
├── useShipTextureRendering(layers, ships, textureCache)
│   └── shipSprites 层渲染舰船贴图 Sprite
└── useWeaponTextureRendering(layers, ships, textureCache)
    └── shipSprites 层渲染武器贴图 Sprite
```

### 新增文件

| 文件 | 功能 |
|------|------|
| `useTextureLoader.ts` | 预加载贴图到 PixiJS Texture 缓存 |
| `ShipTextureRenderer.ts` | 舰船贴图精灵渲染 |
| `WeaponTextureRenderer.ts` | 武器贴图精灵渲染 |

### Texture Schema 应用

```typescript
interface Texture {
  assetId?: string;   // 贴图资产ID
  offsetX?: number;   // X偏移（世界坐标）
  offsetY?: number;   // Y偏移
  scale?: number;     // 缩放比例
}

// 舰船贴图
sprite.position.set(
  ship.runtime.position.x + offsetX,
  ship.runtime.position.y + offsetY
);
sprite.rotation = heading * Math.PI / 180;
sprite.scale.set(scale ?? 1);

// 武器贴图（考虑舰船旋转）
const cos = Math.cos(shipHeadingRad);
const sin = Math.sin(shipHeadingRad);
const rotatedMountX = mountOffsetX * cos - mountOffsetY * sin;
const rotatedMountY = mountOffsetX * sin + mountOffsetY * cos;
sprite.position.set(
  shipPos.x + rotatedMountX + weaponOffsetX,
  shipPos.y + rotatedMountY + weaponOffsetY
);
sprite.rotation = (shipHeading + mountFacing) * Math.PI / 180;
```

### 渲染层

| 层 | zIndex | 内容 |
|----|--------|------|
| shipSprites | 6 | 舰船/武器贴图精灵 |
| tacticalTokens | 7 | 舰船战术标记（菱形箭头） |

### Props

```typescript
interface GameCanvasProps {
  ships: CombatToken[];
  fetchAssets?: (assetIds, includeData) => Promise<AssetBatchGetResult[]>;
  showShipTextures?: boolean;  // 贴图开关
}
```

### GamePage 整合

```typescript
<PixiCanvas
  ships={tokens}
  fetchAssets={assetSocket.batchGet}
/>
```

---

## 其他已完成

### 舰船渲染图层修复 ✅
- tacticalTokens.visible 设置正确

### 挂点管理重构 ✅
- 横向卡片布局，实时预览

### 准备按钮修复 ✅
- sessionId/playerId 匹配