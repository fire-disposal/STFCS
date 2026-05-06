# 三模式视图架构

## 核心决策

**单一 PixiJS Application，永不卸载。**模式切换时只切换各层的可见性。

## 为什么不是两个 Canvas？

| 方案 | 问题 |
|------|------|
| SVG StarMap | 没有缩放/平移，需另写一套交互 |
| 两个 PixiJS App | 卸载/挂载开销，状态丢失 |
| **单一 App + 层切换** | 交互复用，零开销，无状态丢失 |

## 实现

```
┌─────────────────────────────────────────────┐
│  PixiJS Application (单例，永不卸载)          │
│                                              │
│  world container                             │
│  ├── [0] background/starfield  ← 模式相关     │
│  ├── [4] grid                 ← 仅 COMBAT    │
│  ├── [5] starMapEdges         ← 仅 WORLD     │
│  ├── [6] starMapNodes         ← 仅 WORLD     │
│  ├── [7] tacticalTokens       ← 仅 COMBAT    │
│  ├── [8] weaponArcs           ← 仅 COMBAT    │
│  ├── [9] movementVisuals      ← 仅 COMBAT    │
│  ├── [10] shieldArcs          ← 仅 COMBAT    │
│  ├── [11] hexagonArmor        ← 仅 COMBAT    │
│  ├── [13] shipSprites         ← 仅 COMBAT    │
│  └── [14] weaponSprites       ← 仅 COMBAT    │
│                                              │
│  HUD container                                │
│  └── shipBars/...             ← 仅 COMBAT    │
│                                              │
│  交互（通用）：                                 │
│  ├── 右键拖拽 → 平移                         │
│  ├── 滚轮    → 缩放                          │
│  ├── 左键点击 → 选中/交互                     │
│  └── viewRotation → 仅 COMBAT                │
└─────────────────────────────────────────────┘
```

## 实施步骤

1. LayerRegistry 新增 starMapEdges/starMapNodes/starMapLabels 层
2. 新建 useStarMapRendering hook（Graphics 画圆+线+Text 标名）
3. PixiCanvas 接受 viewMode prop，各层 visible 绑定 mode
4. GamePage 传 viewMode 给 PixiCanvas
5. 删除 SVG StarMap 组件
