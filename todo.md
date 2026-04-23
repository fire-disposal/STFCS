## 武器射界修复 ✅

### 问题
1. 切换舰船时武器射界不更新
2. 暗红色圆形来源不明

### 修复

**WeaponArcRenderer.ts useEffect 逻辑：**
```typescript
// 之前：只设置 visible=false，缓存残留
cache.root.visible = false;

// 修复后：完全清除缓存
layers.weaponArcs.removeChild(cache.root);
cache.root.destroy();
arcCacheRef.current.clear();
aimLineCacheRef.current.clear();
```

### 暗红色圆形来源

| 来源 | 颜色 | 含义 |
|------|------|------|
| `WeaponArcRenderer:274` | #ff5d7e | 最小射程（盲区） |
| `FluxIndicatorRenderer` | #ff5d7e | 辐能临界 (>90%) |
| `AimLines` | #ff5d7e | 目标不在射程/射界内 |

### 提交记录
```
abd41fe fix: 瞄准线从武器挂点位置绘制
f19e474 fix: 舰船渲染状态更新时机和图层顺序
2f63da4 feat: UI优化 - 辐能翻译/回合推进/武器火控
本次 fix: 武器射界切换舰船时正确更新
```

---

## 其他已完成

- 舰船贴图渲染系统 ✅
- 图层顺序调整 ✅
- 辐能翻译统一 ✅