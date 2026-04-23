## 舰船渲染问题修复 ✅

### 问题诊断
根本原因：**图层可见性设置错误**
- ShipRenderer.ts 第119行设置 `shipSprites.visible = true`
- 但舰船实际添加到 `tacticalTokens` 层（第264行）
- 导致舰船永远无法显示

### 修复内容

**1. ShipRenderer.ts**
```typescript
// 错误代码
layers.shipSprites.visible = true;

// 正确代码
layers.tacticalTokens.visible = true;
```

**2. PixiCanvas.tsx**
```typescript
useEffect(() => {
    if (!layerSystem.layers) return;
    layerSystem.layers.tacticalTokens.visible = true;  // 新增
    layerSystem.layers.effects.visible = showEffects;
    layerSystem.layers.shipIcons.visible = showShipIcons;
}, [...]);
```

**3. 诊断日志**
- `useTokens`: 打印 tokens 数量和 runtime/position 数据
- `useShipRendering`: 打印 ships 数量及有 position 的数量

---

## 其他已完成

### 挂点管理重构 ✅
- 横向卡片布局（左侧列表 + 右侧详情）
- 添加/删除/编辑功能完整
- mountsHash 实时预览更新

### 准备按钮修复 ✅
- sessionId/playerId 匹配问题

---

## 待实际运行验证
启动 `pnpm dev` 测试舰船部署和渲染