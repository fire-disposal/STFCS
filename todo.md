## 舰船渲染问题修复 ✅

### 修复内容

**1. 状态更新时机**
- `useTokens` 添加 `Object.keys(tokens).join(",")` 作为依赖
- `useSocketRoom` 使用 `{ ...gameState.tokens }` 创建新引用
- 部署舰船后立即触发渲染

**2. 部署继承游标朝向**
```typescript
const cursorHeading = mapCursor?.r ?? 0;
runtime: {
  position: cursorPosition,
  heading: cursorHeading,  // 继承游标朝向
  ...
}
```

**3. 图层顺序调整**
```
世界层 zIndex 排序：
├── 0-5: 背景/星空/网格/游标
├── 7: tacticalTokens (战术标记 - 菱形箭头)
├── 8-14: effects/weaponArcs/movement/shield/armor/flux
└── 15: shipSprites (贴图精灵 - 最高层)
```

贴图在战术标记之上，确保视觉效果正确。

---

## 完整修复清单

| 提交 | 内容 |
|------|------|
| bb5b796 | 废弃 ShipViewModel，统一 CombatToken |
| 482545e | 重构挂点管理UI |
| 1250123 | 挂点预览实时更新 |
| 656967d | 图层可见性修复 |
| e46c6e8 | 舰船贴图渲染系统 |
| 847ad99 | 移除调试日志 |
| 本次 | 状态更新时机 + 图层顺序 + 朝向继承 |

---

## 待测试验证

启动 `pnpm dev` 测试：
1. 部署舰船观察是否立即渲染
2. 验证朝向继承游标旋转
3. 确认战术标记和贴图分层正确