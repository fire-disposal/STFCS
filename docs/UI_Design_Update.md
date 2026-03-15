# UI设计更新文档
## 基于反馈的修正方案

---

## 📋 反馈总结与修正

### 1. 顶栏设计 - 保持现有风格 ✅

**决策**: 顶栏保持现有的 `rgba(20, 20, 40, 0.98)` 不透明风格，无需透明化。

**理由**: 
- 顶栏作为系统功能区，需要清晰边界
- 现有风格与科幻主题协调
- 保持与底部面板的视觉区分

### 2. 缩放指示器 - 移至中间并改为表尺风格 🔧

**原设计**: 左侧实心柱状条
**新设计**: 顶栏中央，类表尺竖线风格

```
顶栏布局:
┌─────────────────────────────────────────────────────────────────────────┐
│ [菜单] STFCS    │    [表尺缩放指示器]    │    [设置] [玩家] [断开]     │
│                 │                        │                             │
│   左侧功能区     │      中央信息区         │         右侧功能区          │
│   (固定)        │      (弹性宽度)        │         (固定)             │
└─────────────────────────────────────────────────────────────────────────┘
```

**表尺缩放指示器设计**:
```
┌────────────────────────────────────────┐
│  100%    │  │  │  │  │  │  │  ▲  │  │  │  [+] [-] [R]  │
│  1:1000  │  │  ▓  │  │  │  │  │  │  │  │               │
│          │  │  ▓  │  │  │  │  │  │  │  │               │
└────────────────────────────────────────┘
           ↑     ↑                       ↑
         刻度线  当前值指示器(竖线)      控制按钮
```

### 3. 设置按钮 - 保留在顶栏 ✅

**决策**: 设置按钮保留在顶栏右侧，通过菜单按钮访问。

**底部面板原则**: 
- 纯游戏相关操作
- 不放置系统/配置类按钮
- 保持战术沉浸感

### 4. 底部面板 - 纯游戏相关 🎮

**允许内容**:
- 舰船操作控制（移动、转向、武器）
- 单位状态显示（护盾、装甲、能量）
- 战术信息（距离、角度、速度）
- 回合相关操作（结束回合、行动点）

**禁止内容**:
- 系统设置按钮
- 语言切换
- 音量控制
- 断开连接按钮
- 任何非战术相关功能

---

## 🎨 表尺缩放指示器详细设计

### 视觉风格

```css
/* 表尺缩放指示器 */
.ruler-zoom-indicator {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 6px 16px;
  background: rgba(15, 18, 28, 0.9);
  border: 1px solid rgba(74, 158, 255, 0.3);
  border-radius: 2px;  /* 最小圆角，保持硬朗 */
}

/* 数值显示区 */
.ruler-zoom-values {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 60px;
}

.ruler-zoom-percentage {
  font-family: 'Share Tech Mono', monospace;
  font-size: 16px;
  font-weight: 600;
  color: #4a9eff;
  line-height: 1;
}

.ruler-zoom-scale {
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  color: #6a7a9f;
  margin-top: 2px;
}

/* 表尺主体 */
.ruler-scale-container {
  position: relative;
  width: 200px;
  height: 32px;
  display: flex;
  align-items: center;
}

/* 表尺刻度线 */
.ruler-scale-track {
  width: 100%;
  height: 2px;
  background: rgba(74, 158, 255, 0.2);
  position: relative;
}

/* 刻度标记 */
.ruler-tick {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  background: rgba(74, 158, 255, 0.4);
}

.ruler-tick--major {
  height: 12px;
}

.ruler-tick--minor {
  height: 6px;
}

.ruler-tick--medium {
  height: 8px;
}

/* 当前值指示器 - 竖线风格 */
.ruler-value-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    #4a9eff 20%,
    #4a9eff 80%,
    transparent 100%
  );
  box-shadow: 
    0 0 8px rgba(74, 158, 255, 0.6),
    0 0 16px rgba(74, 158, 255, 0.3);
  transition: left 0.15s ease-out;
  pointer-events: none;
}

/* 指示器顶部三角形标记 */
.ruler-value-indicator::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid #4a9eff;
}

/* 当前值标签 */
.ruler-value-label {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Share Tech Mono', monospace;
  font-size: 9px;
  color: #4a9eff;
  background: rgba(10, 12, 20, 0.9);
  padding: 1px 4px;
  border: 1px solid rgba(74, 158, 255, 0.3);
  white-space: nowrap;
}

/* 控制按钮 */
.ruler-zoom-controls {
  display: flex;
  gap: 4px;
}

.ruler-zoom-btn {
  width: 28px;
  height: 28px;
  background: rgba(40, 50, 70, 0.6);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: #4a9eff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: 0;  /* 无圆角 */
}

.ruler-zoom-btn:hover:not(:disabled) {
  background: rgba(74, 158, 255, 0.2);
  border-color: rgba(74, 158, 255, 0.6);
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.3);
}

.ruler-zoom-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ruler-zoom-btn--reset {
  width: 32px;
}
```

### 刻度分布逻辑

```typescript
interface RulerTick {
  position: number;  // 0-100%
  type: 'major' | 'medium' | 'minor';
  label?: string;
}

// 生成刻度
const generateTicks = (minZoom: number, maxZoom: number): RulerTick[] => {
  const ticks: RulerTick[] = [];
  const count = 20; // 总刻度数
  
  for (let i = 0; i <= count; i++) {
    const position = (i / count) * 100;
    let type: RulerTick['type'] = 'minor';
    
    if (i % 10 === 0) {
      type = 'major';  // 每10个刻度一个主刻度
    } else if (i % 5 === 0) {
      type = 'medium'; // 每5个刻度一个中刻度
    }
    
    ticks.push({
      position,
      type,
      label: type === 'major' ? `${(minZoom + (maxZoom - minZoom) * (i / count)).toFixed(1)}x` : undefined
    });
  }
  
  return ticks;
};
```

### 组件实现

```tsx
import React, { useMemo } from 'react';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RulerZoomIndicatorProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export const RulerZoomIndicator: React.FC<RulerZoomIndicatorProps> = ({
  zoom,
  minZoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
  onReset,
}) => {
  const { t } = useTranslation();
  
  // 计算当前位置百分比
  const positionPercent = ((zoom - minZoom) / (maxZoom - minZoom)) * 100;
  
  // 获取比例尺标签
  const getScaleLabel = (z: number) => {
    if (z >= 3) return '1:100';
    if (z >= 2) return '1:250';
    if (z >= 1.5) return '1:500';
    if (z >= 1) return '1:1000';
    if (z >= 0.75) return '1:2500';
    return '1:5000';
  };
  
  // 生成刻度
  const ticks = useMemo(() => {
    const result = [];
    for (let i = 0; i <= 20; i++) {
      const position = (i / 20) * 100;
      let type = 'minor';
      if (i % 5 === 0) type = 'medium';
      if (i % 10 === 0) type = 'major';
      result.push({ position, type });
    }
    return result;
  }, []);
  
  return (
    <div className="ruler-zoom-indicator">
      {/* 数值显示 */}
      <div className="ruler-zoom-values">
        <span className="ruler-zoom-percentage">{(zoom * 100).toFixed(0)}%</span>
        <span className="ruler-zoom-scale">{getScaleLabel(zoom)}</span>
      </div>
      
      {/* 表尺 */}
      <div className="ruler-scale-container">
        <div className="ruler-scale-track">
          {ticks.map((tick, index) => (
            <div
              key={index}
              className={`ruler-tick ruler-tick--${tick.type}`}
              style={{ left: `${tick.position}%` }}
            />
          ))}
        </div>
        
        {/* 当前值指示器 */}
        <div 
          className="ruler-value-indicator"
          style={{ left: `${positionPercent}%` }}
        >
          <span className="ruler-value-label">{zoom.toFixed(2)}x</span>
        </div>
      </div>
      
      {/* 控制按钮 */}
      <div className="ruler-zoom-controls">
        <button
          className="ruler-zoom-btn"
          onClick={onZoomOut}
          disabled={zoom <= minZoom}
          title={t('zoom.out')}
        >
          <ZoomOut size={16} />
        </button>
        <button
          className="ruler-zoom-btn ruler-zoom-btn--reset"
          onClick={onReset}
          title={t('zoom.reset')}
        >
          <RefreshCw size={14} />
        </button>
        <button
          className="ruler-zoom-btn"
          onClick={onZoomIn}
          disabled={zoom >= maxZoom}
          title={t('zoom.in')}
        >
          <ZoomIn size={16} />
        </button>
      </div>
    </div>
  );
};
```

---

## 🎮 底部面板纯净设计

### 设计原则

**核心信条**: 底部面板 = 战术控制台，不是系统菜单

```
底部面板内容边界:
┌─────────────────────────────────────────────────────────────────┐
│ ✅ 允许                          │ ❌ 禁止                      │
├──────────────────────────────────┼──────────────────────────────┤
│ 舰船移动控制                      │ 系统设置                     │
│ 武器系统操作                      │ 语言切换                     │
│ 护盾/能量管理                     │ 音量控制                     │
│ 航向角/距离调整                   │ 断开连接按钮                 │
│ 行动点显示                        │ 游戏外功能                   │
│ 回合相关操作                      │ 非战术信息                   │
│ 单位状态条                        │ 聊天窗口（移至右侧）          │
│ 紧急战术按钮                      │                              │
└──────────────────────────────────┴──────────────────────────────┘
```

### 纯净底部面板布局

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              战术指挥面板 (64-80px)                                   │
├──────────────────────────┬──────────────────────────────┬───────────────────────────┤
│      左侧：选中单位       │       中央：战术控制台        │      右侧：战斗状态        │
│     (200px, 固定)        │        (弹性宽度)            │     (180px, 固定)         │
├──────────────────────────┼──────────────────────────────┼───────────────────────────┤
│ ┌──────────────────────┐ │ ┌──────────────────────────┐ │ ┌───────────────────────┐ │
│ │ [舰船图标]            │ │ │  [航向角控制] [距离控制]  │ │ │  护盾 [████████░░] 80%│ │
│ │ 企业号                │ │ │                          │ │ │  装甲 [██████████]100%│ │
│ │ 巡洋舰                │ │ │  [武器挂载面板]           │ │ │  通量 [██████░░░░] 60%│ │
│ │ Player1               │ │ │  [武器1] [武器2] [武器3]  │ │ │                       │ │
│ │                      │ │ │   就绪   冷却   就绪      │ │ │  行动点: ● ● ○        │ │
│ │ [展开详细 ▼]          │ │ │                          │ │ │  移动力: 150/300      │ │
│ └──────────────────────┘ │ │  [结束回合] [紧急规避]     │ │ │                       │ │
│                          │ │                          │ │ │ [散热] [护盾开关]     │ │
└──────────────────────────┴──────────────────────────────┴───────────────────────────┘
```

### 展开详细模式（战术全屏）

```
详细模式 (240px):
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│  ┌──────────────┐  ┌─────────────────────────────────────────────────────────────┐ │
│  │              │  │  移动控制 │ 武器系统 │ 舰船系统 │ 战术动作                     │ │
│  │   舰船大图    │  ├─────────────────────────────────────────────────────────────┤ │
│  │   3D预览     │  │                                                             │ │
│  │              │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │ │
│  │  [涂装预览]   │  │  │  航向角罗盘  │  │  距离滑块    │  │     武器详情         │  │ │
│  │              │  │  │             │  │             │  │                     │  │ │
│  │  护盾: 80%   │  │  │     ▲      │  │  [====▓====] │  │  重型激光炮 Mk.II   │  │ │
│  │  装甲: 100%  │  │  │   ╱   ╲    │  │             │  │  伤害: 150           │  │ │
│  │  结构: 100%  │  │  │  ╱ 127° ╲  │  │  4500km     │  │  射程: 1200          │  │ │
│  │              │  │  │ ╱_________╲│  │  37.5s      │  │  射界: 60°           │  │ │
│  │              │  │  │             │  │  能量: 125  │  │  [开火] [瞄准]       │  │ │
│  │              │  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │ │
│  └──────────────┘  │                                                             │ │
│                    └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 更新后的整体布局

### 最终布局架构

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ 顶栏 (48px) - 保持现有风格，不透明                                                    │
│ [菜单] STFCS    [表尺缩放指示器]    [设置] [玩家名] [断开]                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌──────────┐                                                            ┌─────────┐│
│  │ 左侧     │                                                            │ 右侧    ││
│  │ 收缩面板  │                                                            │ 信息面板 ││
│  │ (32px    │                                                            │ (280px) ││
│  │ 展开     │                                                            │         ││
│  │ 240px)   │                                                            │ ┌─────┐ ││
│  │          │                                                            │ │聊天 │ ││
│  │          │                                                            │ │窗口 │ ││
│  │          │                                                            │ └─────┘ ││
│  │          │                                                            │         ││
│  └──────────┘                                                            └─────────┘│
│                                                                                     │
│                              主游戏画布区域                                          │
│                              (最大化空间)                                            │
│                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ 底部战术面板 (64-80px) - 纯游戏相关，无系统按钮                                       │
│ [单位概览] [航向角控制] [距离控制] [武器挂载] [状态条] [行动点] [战术按钮]           │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 空间分配

| 区域 | 高度/宽度 | 说明 |
|------|-----------|------|
| 顶栏 | 48px | 固定，系统功能 |
| 左侧面板 | 32-240px | 可折叠，图层控制 |
| 右侧面板 | 280px | 可折叠，聊天+日志 |
| 底部面板 | 64-240px | 战术控制台 |
| 游戏画布 | 剩余空间 | 最大化 |

**有效游戏区域**: ~75-80% (相比当前的60%)

---

## 📝 实施检查清单

### 顶栏修改
- [ ] 保持现有不透明风格
- [ ] 缩放指示器移至中央
- [ ] 实现表尺风格缩放指示器
- [ ] 设置按钮保留在菜单中

### 底部面板修改
- [ ] 移除所有系统按钮
- [ ] 纯战术功能布局
- [ ] 展开详细模式设计
- [ ] 保持硬朗科幻风格

### 风格统一
- [ ] 圆角控制: 0-2px
- [ ] 颜色系统统一
- [ ] 字体规范执行
- [ ] 动画效果一致

---

*更新版本: 1.1*
*更新日期: 2026-03-15*
*更新内容: 根据反馈修正顶栏和底部面板设计*
