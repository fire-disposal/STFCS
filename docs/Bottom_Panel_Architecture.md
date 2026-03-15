# 底部面板架构设计文档
## RTS风格舰船指挥控制台

---

## 🎯 设计哲学

### 核心原则
1. **驾驶舱沉浸感** - 玩家是指挥官，不是旁观者
2. **信息密度最大化** - 在有限空间展示最关键数据
3. **操作效率优先** - 常用功能一键可达
4. **动态自适应** - 根据选中对象智能切换显示内容
5. **硬朗科幻风格** - 减少圆角，使用锐利线条和金属质感

### 风格规范
```css
/* 圆角规范 - 严格控制 */
--radius-sharp: 0px;      /* 按钮、输入框 */
--radius-subtle: 2px;     /* 面板、卡片 */
--radius-small: 4px;      /* 最大圆角，仅用于特殊元素 */

/* 边框风格 */
--border-tech: 1px solid rgba(74, 158, 255, 0.3);
--border-glow: 0 0 8px rgba(74, 158, 255, 0.4);
--border-active: 1px solid rgba(74, 158, 255, 0.8);

/* 颜色系统 */
--color-hud-bg: rgba(10, 12, 20, 0.95);      /* HUD背景 */
--color-panel-bg: rgba(15, 18, 28, 0.9);     /* 面板背景 */
--color-primary: #4a9eff;                     /* 科技蓝 */
--color-warning: #ffaa00;                     /* 警告橙 */
--color-danger: #ff4444;                      /* 危险红 */
--color-success: #00ff88;                     /* 成功绿 */
--color-text-primary: #e0e6f0;               /* 主文字 */
--color-text-secondary: #8a94a8;             /* 次要文字 */
--color-text-dim: #5a6478;                   /* 暗淡文字 */
```

---

## 📐 布局架构

### 整体结构
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    底部指挥面板 (64-80px)                             │
│  固定高度，三栏布局，可根据选中对象扩展为详细模式 (200-280px)                          │
├──────────────────────────┬──────────────────────────────┬───────────────────────────┤
│      左侧：单位概览        │       中央：操作控制台        │      右侧：系统状态        │
│     (240px, 可扩展)       │        (弹性宽度)            │     (200px, 固定)         │
├──────────────────────────┼──────────────────────────────┼───────────────────────────┤
│ ┌──────────────────────┐ │ ┌──────────────────────────┐ │ ┌───────────────────────┐ │
│ │ [舰船缩略图]          │ │ │    动态操作区域           │ │ │  系统状态指示器        │ │
│ │ 名称/类型/玩家        │ │ │  根据选中对象类型切换      │ │ │  护盾/装甲/结构        │ │
│ │ 基础状态条            │ │ │  - 无选中：全局视图        │ │ │  能量/热量/通量        │ │
│ │                      │ │ │  - 舰船：移动/武器/系统    │ │ │  回合/行动点           │ │
│ │ [展开按钮] → 详细面板  │ │ │  - 建筑：生产/防御/科技    │ │ │                      │ │
│ └──────────────────────┘ │ │  - 环境：信息/扫描         │ │ │ [DM按钮] [设置]        │ │
└──────────────────────────┴──────────────────────────────┴───────────────────────────┘
```

### 响应式扩展机制
```
紧凑模式 (默认): 64-80px 高度，显示关键信息
详细模式 (展开): 200-280px 高度，显示完整操作界面
全屏模式 (可选): 覆盖底部50%屏幕，用于复杂操作
```

---

## 🎛️ 组件详细设计

### 1. 左侧：单位概览面板 (UnitOverviewPanel)

#### 功能职责
- 显示当前选中单位的核心信息
- 提供快速状态查看
- 作为展开详细面板的入口

#### 数据结构
```typescript
interface UnitOverviewData {
  // 基础信息
  id: string;
  name: string;
  type: 'ship' | 'station' | 'asteroid' | 'debris';
  ownerId: string;
  ownerName: string;
  faction?: string;
  
  // 视觉
  thumbnailUrl?: string;
  iconType: string;
  color: string;
  
  // 状态 (根据类型变化)
  status: {
    health?: { current: number; max: number };
    shield?: { current: number; max: number; active: boolean };
    armor?: { current: number; max: number };
    flux?: { current: number; max: number; soft: number; hard: number };
    energy?: { current: number; max: number };
    heat?: { current: number; max: number };
    // 建筑特有
    production?: { current: number; max: number; queue: number };
    // 环境特有
    stability?: number;
    resources?: number;
  };
  
  // 位置信息
  position: { x: number; y: number };
  heading: number;
  velocity: number;
}
```

#### UI设计
```
┌────────────────────────────────┐
│  ┌──────┐  企业号              │
│  │缩略图 │  巡洋舰 · Player1    │
│  │  ▲   │                     │
│  └──────┘  护盾 ████████░░ 80% │
│            装甲 ██████████ 100%│
│            [展开详细 ▼]         │
└────────────────────────────────┘
```

#### 样式规范
```css
.unit-overview {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  background: var(--color-panel-bg);
  border-right: var(--border-tech);
}

.unit-thumbnail {
  width: 48px;
  height: 48px;
  border: 1px solid rgba(74, 158, 255, 0.4);
  border-radius: 2px;  /* 最小圆角 */
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* 舰船朝向指示器 */
.unit-thumbnail::after {
  content: '';
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 6px solid var(--color-primary);
}

.status-bar {
  height: 4px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 0;  /* 无圆角 */
  overflow: hidden;
  margin-top: 4px;
}

.status-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.status-bar-fill.shield { background: linear-gradient(90deg, #4a9eff, #6ab3ff); }
.status-bar-fill.armor { background: linear-gradient(90deg, #ffaa00, #ffcc00); }
.status-bar-fill.structure { background: linear-gradient(90deg, #ff4444, #ff6666); }
```

---

### 2. 中央：操作控制台 (CommandConsole)

#### 功能职责
- 根据选中对象类型动态显示操作界面
- 提供精确控制输入（航向角、距离等）
- 武器系统管理和选择
- 舰船系统控制

#### 模式切换逻辑
```typescript
type ConsoleMode = 
  | 'global'      // 无选中对象 - 显示全局信息
  | 'ship'        // 选中舰船 - 显示舰船操作
  | 'station'     // 选中建筑 - 显示建筑操作
  | 'environment' // 选中环境对象 - 显示扫描信息
  | 'multi'       // 多选（未来扩展）
  | 'combat';     // 战斗模式 - 显示武器和战术

interface CommandConsoleProps {
  mode: ConsoleMode;
  selectedUnit: UnitOverviewData | null;
  combatState?: CombatState;
  onAction: (action: CommandAction) => void;
}
```

#### 2.1 舰船操作模式 (ShipCommandMode)

##### 布局结构
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 移动控制 │ 武器系统 │ 舰船系统 │ 战术动作                                      │
├─────────┴─────────┴─────────┴───────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────────────────┐  │
│  │   航向角控制   │  │   距离控制     │  │         武器挂载面板             │  │
│  │               │  │               │  │                                 │  │
│  │    [罗盘]     │  │  [滑块+输入]   │  │  [武器1] [武器2] [武器3] [武器4] │  │
│  │     ▲        │  │               │  │   就绪    冷却    就绪    装填   │  │
│  │   ╱   ╲      │  │  当前: 4500km │  │                                 │  │
│  │  ╱ 127° ╲    │  │  预计: 37.5s  │  │  选中武器详情:                   │  │
│  │ ╱_________╲  │  │  能量: 125    │  │  重型激光炮 Mk.II               │  │
│  │               │  │               │  │  伤害: 150  射程: 1200          │  │
│  │ [ -5°] [+5°] │  │ [100] [500]   │  │  射界: 60°    通量: 85          │  │
│  │ [直接输入]    │  │ [1000] [5000] │  │  [开火] [瞄准] [解除]            │  │
│  └───────────────┘  └───────────────┘  └─────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

##### 航向角控制组件 (HeadingControl)

```typescript
interface HeadingControlProps {
  currentHeading: number;
  targetHeading?: number;
  onHeadingChange: (heading: number) => void;
  onHeadingCommit: (heading: number) => void;
  disabled?: boolean;
}
```

**交互设计：**
1. **圆形罗盘** - 拖动旋转，实时预览目标航向
2. **微调按钮** - ±1°, ±5°, ±15°, ±45° 快速调整
3. **滑块控制** - 0°-360° 精确滑动
4. **数字输入** - 直接输入精确角度
5. **快捷键支持** - 方向键微调，Shift+方向键大步进

**视觉设计：**
```css
.heading-control {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.heading-compass {
  width: 80px;
  height: 80px;
  border: 2px solid rgba(74, 158, 255, 0.4);
  border-radius: 0;  /* 方形罗盘，硬朗风格 */
  position: relative;
  background: 
    linear-gradient(0deg, transparent 49%, rgba(74, 158, 255, 0.2) 49%, rgba(74, 158, 255, 0.2) 51%, transparent 51%),
    linear-gradient(90deg, transparent 49%, rgba(74, 158, 255, 0.2) 49%, rgba(74, 158, 255, 0.2) 51%, transparent 51%),
    radial-gradient(circle at center, rgba(74, 158, 255, 0.1) 0%, transparent 70%);
}

/* 当前航向指针 */
.heading-compass-needle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 35%;
  background: var(--color-primary);
  transform-origin: bottom center;
  transform: translate(-50%, -100%) rotate(var(--heading));
  clip-path: polygon(50% 0%, 0% 100%, 100% 100%);  /* 三角形指针 */
}

/* 目标航向标记 */
.heading-compass-target {
  position: absolute;
  width: 8px;
  height: 8px;
  border: 2px solid var(--color-warning);
  transform: translate(-50%, -50%) rotate(var(--target-heading));
  top: 15%;
  left: 50%;
  transform-origin: 50% 250%;  /* 围绕中心旋转 */
}

.heading-fine-controls {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.heading-btn {
  padding: 4px 8px;
  background: rgba(40, 50, 70, 0.6);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-family: 'Share Tech Mono', monospace;
  cursor: pointer;
  transition: all 0.15s ease;
  border-radius: 0;  /* 无圆角 */
}

.heading-btn:hover {
  background: rgba(74, 158, 255, 0.2);
  border-color: rgba(74, 158, 255, 0.6);
  color: var(--color-text-primary);
}

.heading-input {
  width: 60px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(74, 158, 255, 0.4);
  color: var(--color-primary);
  font-family: 'Share Tech Mono', monospace;
  font-size: 14px;
  text-align: center;
  border-radius: 0;
}

.heading-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.3);
}
```

##### 距离控制组件 (DistanceControl)

```typescript
interface DistanceControlProps {
  currentPosition: { x: number; y: number };
  targetPosition?: { x: number; y: number };
  maxDistance: number;
  remainingMovement: number;
  onDistanceChange: (distance: number) => void;
  onPositionCommit: (position: { x: number; y: number }) => void;
}
```

**功能特性：**
1. **滑块控制** - 0 到最大移动距离
2. **预设按钮** - 常用距离快速选择
3. **坐标输入** - 直接输入目标坐标
4. **实时计算** - 显示预计时间、能量消耗
5. **路径预览** - 在游戏画布上显示移动轨迹

**视觉设计：**
```css
.distance-control {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}

.distance-slider-container {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
}

.distance-slider-track {
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.5);
  position: relative;
}

.distance-slider-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-success));
  transition: width 0.1s ease;
}

.distance-slider-thumb {
  position: absolute;
  width: 12px;
  height: 16px;
  background: var(--color-primary);
  border: 1px solid rgba(255, 255, 255, 0.3);
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
  clip-path: polygon(50% 0%, 100% 40%, 100% 100%, 0% 100%, 0% 40%);  /* 指针形状 */
}

.distance-presets {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.distance-preset-btn {
  padding: 4px 10px;
  background: rgba(40, 50, 70, 0.6);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-family: 'Share Tech Mono', monospace;
  cursor: pointer;
  border-radius: 0;
  transition: all 0.15s ease;
}

.distance-preset-btn:hover {
  background: rgba(74, 158, 255, 0.2);
  border-color: rgba(74, 158, 255, 0.6);
}

.distance-preset-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.distance-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  font-size: 11px;
  font-family: 'Share Tech Mono', monospace;
}

.distance-info-item {
  display: flex;
  justify-content: space-between;
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.3);
}

.distance-info-label {
  color: var(--color-text-dim);
}

.distance-info-value {
  color: var(--color-primary);
}
```

##### 武器挂载面板 (WeaponMountPanel)

```typescript
interface WeaponMountPanelProps {
  mounts: WeaponMountData[];
  selectedMountId: string | null;
  onMountSelect: (mountId: string) => void;
  onWeaponFire: (mountId: string) => void;
  onWeaponAim: (mountId: string) => void;
  targetLock?: string | null;
}

interface WeaponMountData {
  id: string;
  weapon: WeaponSpec;
  status: 'ready' | 'cooling' | 'reloading' | 'disabled';
  cooldownProgress: number;  // 0-100
  ammo?: { current: number; max: number };
  facing: number;
  arc: number;
}
```

**视觉设计：**
```css
.weapon-mounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
  gap: 4px;
}

.weapon-mount-slot {
  aspect-ratio: 1;
  background: rgba(20, 25, 35, 0.8);
  border: 1px solid rgba(74, 158, 255, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
  border-radius: 0;
}

.weapon-mount-slot:hover {
  border-color: rgba(74, 158, 255, 0.5);
  background: rgba(74, 158, 255, 0.1);
}

.weapon-mount-slot.selected {
  border-color: var(--color-primary);
  background: rgba(74, 158, 255, 0.15);
  box-shadow: inset 0 0 12px rgba(74, 158, 255, 0.2);
}

.weapon-mount-slot.ready {
  border-left: 3px solid var(--color-success);
}

.weapon-mount-slot.cooling {
  border-left: 3px solid var(--color-warning);
}

.weapon-mount-slot.reloading {
  border-left: 3px solid var(--color-danger);
}

.weapon-mount-icon {
  font-size: 20px;
  margin-bottom: 2px;
}

.weapon-mount-status {
  font-size: 9px;
  font-family: 'Share Tech Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.weapon-mount-status.ready { color: var(--color-success); }
.weapon-mount-status.cooling { color: var(--color-warning); }
.weapon-mount-status.reloading { color: var(--color-danger); }

/* 冷却进度条 */
.weapon-cooldown-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255, 170, 0, 0.3);
  transition: height 0.1s linear;
}
```

#### 2.2 全局视图模式 (GlobalViewMode)

当没有选中任何单位时显示：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 全局状态 │ 回合信息 │ 玩家列表 │ 系统消息                                      │
├─────────┴─────────┴─────────┴───────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │    回合进度       │  │    玩家状态       │  │      系统消息             │  │
│  │                  │  │                  │  │                          │  │
│  │  第 3 回合        │  │  ● Player1      │  │  [12:30:45] 回合开始      │  │
│  │  行动阶段         │  │  ○ Player2      │  │  [12:31:10] Player1 移动  │  │
│  │                  │  │  ● Player3 (DM) │  │  [12:31:25] 战斗开始      │  │
│  │  [████████░░] 80%│  │                  │  │                          │  │
│  │                  │  │  3/4 玩家在线    │  │                          │  │
│  │  当前: 企业号     │  │                  │  │                          │  │
│  │  下一位: 毁灭号   │  │                  │  │                          │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3. 右侧：系统状态面板 (SystemStatusPanel)

#### 功能职责
- 显示选中单位的详细状态
- 系统开关控制（护盾、武器等）
- 紧急操作按钮
- DM模式切换

#### 布局结构
```
┌────────────────────────────────┐
│ 系统状态                        │
├────────────────────────────────┤
│ 护盾: [████████░░] 80% [开/关] │
│ 装甲: [██████████] 100%        │
│ 结构: [██████████] 100%        │
│ 通量: [██████░░░░] 60% [散热]  │
│ 能量: [████████░░] 82%         │
├────────────────────────────────┤
│ 行动点: ● ● ○                  │
│ 移动力: 150/300                │
├────────────────────────────────┤
│ [紧急规避] [自毁] [弃船]       │
├────────────────────────────────┤
│ [DM模式] [设置] [帮助]         │
└────────────────────────────────┘
```

#### 状态条组件 (StatusBar)

```typescript
interface StatusBarProps {
  label: string;
  current: number;
  max: number;
  color: 'shield' | 'armor' | 'structure' | 'flux' | 'energy' | 'heat';
  showToggle?: boolean;
  toggleState?: boolean;
  onToggle?: () => void;
  warningThreshold?: number;
  criticalThreshold?: number;
}
```

```css
.status-bar-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.status-bar-label {
  width: 40px;
  font-size: 10px;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-bar-track {
  flex: 1;
  height: 6px;
  background: rgba(0, 0, 0, 0.5);
  position: relative;
  overflow: hidden;
}

/* 分段显示 */
.status-bar-track::before {
  content: '';
  position: absolute;
  inset: 0;
  background: 
    linear-gradient(90deg, 
      transparent 24%, rgba(0,0,0,0.5) 24%, rgba(0,0,0,0.5) 25%,
      transparent 25%, transparent 49%, rgba(0,0,0,0.5) 49%, rgba(0,0,0,0.5) 50%,
      transparent 50%, transparent 74%, rgba(0,0,0,0.5) 74%, rgba(0,0,0,0.5) 75%,
      transparent 75%
    );
  z-index: 1;
}

.status-bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.status-bar-fill.shield { 
  background: linear-gradient(90deg, #2a5a8a, #4a9eff);
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.4);
}
.status-bar-fill.armor { 
  background: linear-gradient(90deg, #8a6a2a, #ffaa00);
}
.status-bar-fill.structure { 
  background: linear-gradient(90deg, #8a2a2a, #ff4444);
}
.status-bar-fill.flux { 
  background: linear-gradient(90deg, #8a2a8a, #ff44ff);
}
.status-bar-fill.energy { 
  background: linear-gradient(90deg, #2a8a5a, #00ff88);
}

.status-bar-value {
  width: 35px;
  font-size: 10px;
  font-family: 'Share Tech Mono', monospace;
  color: var(--color-text-secondary);
  text-align: right;
}

.status-toggle {
  width: 28px;
  height: 14px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(74, 158, 255, 0.3);
  position: relative;
  cursor: pointer;
  transition: all 0.2s ease;
}

.status-toggle.active {
  background: rgba(74, 158, 255, 0.3);
  border-color: var(--color-primary);
}

.status-toggle-thumb {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 10px;
  height: 10px;
  background: var(--color-text-dim);
  transition: all 0.2s ease;
}

.status-toggle.active .status-toggle-thumb {
  left: calc(100% - 11px);
  background: var(--color-primary);
  box-shadow: 0 0 6px rgba(74, 158, 255, 0.6);
}
```

---

## 🔧 扩展面板设计

### 详细模式展开机制

当用户点击左侧"展开详细"按钮时，底部面板向上扩展：

```
紧凑模式 (64px):
┌─────────────────────────────────────────────────────────────────┐
│ 概览 │ 操作控制台 (简化) │ 系统状态                              │
└─────────────────────────────────────────────────────────────────┘

详细模式 (240px):
┌─────────────────────────────────────────────────────────────────┐
│ ┌──────────────┐ ┌──────────────────────────────────────────┐   │
│ │  舰船大图     │ │           详细操作区域                    │   │
│ │  3D预览      │ │  ┌────────┐ ┌────────┐ ┌──────────────┐  │   │
│ │  或详细      │ │  │ 移动   │ │ 武器   │ │ 系统         │  │   │
│ │  信息面板    │ │  │ 控制   │ │ 管理   │ │ 配置         │  │   │
│ │              │ │  └────────┘ └────────┘ └──────────────┘  │   │
│ │ [自定义]     │ │                                          │   │
│ │ [涂装]      │ │  当前选中标签页的详细内容                   │   │
│ │ [升级]      │ │                                          │   │
│ └──────────────┘ └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 舰船自定义面板 (未来扩展)

```typescript
interface ShipCustomizationPanelProps {
  shipId: string;
  
  // 外观
  appearance: {
    skin: string;
    decals: DecalData[];
    engineTrail: string;
    shieldEffect: string;
  };
  
  // 装备
  loadout: {
    weapons: WeaponMountConfig[];
    systems: ShipSystem[];
    hullMods: HullModification[];
  };
  
  // 统计
  stats: {
    hull: number;
    armor: number;
    shield: number;
    flux: number;
    speed: number;
    maneuverability: number;
  };
}
```

---

## 🎨 动画与交互

### 状态切换动画

```css
/* 面板高度过渡 */
.bottom-panel {
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 模式切换淡入淡出 */
.console-mode-content {
  animation: modeFadeIn 0.2s ease;
}

@keyframes modeFadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 状态条变化 */
.status-bar-fill {
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 按钮按下效果 */
.hud-button {
  transition: all 0.1s ease;
}

.hud-button:active {
  transform: scale(0.95);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
}

/* 选中高亮脉冲 */
.selected-indicator {
  animation: selectionPulse 2s ease-in-out infinite;
}

@keyframes selectionPulse {
  0%, 100% {
    box-shadow: 0 0 4px rgba(74, 158, 255, 0.4);
  }
  50% {
    box-shadow: 0 0 12px rgba(74, 158, 255, 0.6);
  }
}
```

### 悬停提示系统

```css
.hud-tooltip {
  position: absolute;
  padding: 6px 10px;
  background: rgba(10, 12, 20, 0.95);
  border: 1px solid rgba(74, 158, 255, 0.4);
  color: var(--color-text-primary);
  font-size: 11px;
  pointer-events: none;
  z-index: 10000;
  opacity: 0;
  transform: translateY(4px);
  transition: all 0.15s ease;
  border-radius: 0;
}

.hud-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}

.hud-tooltip::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid rgba(74, 158, 255, 0.4);
}
```

---

## 📱 响应式适配

### 断点设计

```typescript
const BREAKPOINTS = {
  desktop: 1440,   // 完整三栏布局
  laptop: 1024,    // 简化布局，部分折叠
  tablet: 768,     // 双栏布局，详细模式全屏
  mobile: 480,     // 单栏布局，抽屉式面板
};
```

### 适配策略

**笔记本 (1024-1439px):**
- 左侧面板宽度: 200px → 160px
- 右侧面板: 可折叠为图标栏
- 底部面板: 保持紧凑模式为主

**平板 (768-1023px):**
- 左右面板: 抽屉式滑出
- 底部面板: 占据底部 1/3 屏幕
- 操作按钮: 增大触摸区域

**移动端 (<768px):**
- 底部面板: 全宽抽屉式
- 详细模式: 全屏覆盖
- 手势操作: 滑动切换标签

---

## 🔌 接口定义

### 组件接口

```typescript
// 主面板接口
interface BottomCommandPanelProps {
  // 状态
  selectedUnitId: string | null;
  selectedUnitType: UnitType | null;
  
  // 数据
  unitData: UnitOverviewData | null;
  shipData?: ShipStatus;
  combatState?: CombatState;
  
  // 回调
  onUnitAction: (action: UnitAction) => void;
  onWeaponAction: (action: WeaponAction) => void;
  onSystemToggle: (system: string, state: boolean) => void;
  onHeadingChange: (heading: number) => void;
  onDistanceChange: (distance: number) => void;
  onPositionCommit: (position: { x: number; y: number }) => void;
  
  // 配置
  isDMMode: boolean;
  currentPlayerId: string;
  turnState: TurnState;
}

// 操作类型
interface UnitAction {
  type: 'move' | 'rotate' | 'fire' | 'ability' | 'system';
  payload: unknown;
}

interface WeaponAction {
  type: 'select' | 'fire' | 'aim' | 'reload';
  mountId: string;
  targetId?: string;
}
```

### 状态管理集成

```typescript
// Redux selectors
const selectBottomPanelData = createSelector(
  [selectSelectedToken, selectShips, selectCombatState, selectTurnState],
  (token, ships, combat, turn) => ({
    unitData: token ? transformToUnitOverview(token) : null,
    shipData: token?.type === 'ship' ? ships[token.id] : null,
    combatState: combat,
    turnState: turn,
  })
);
```

---

## 📝 实施建议

### 开发优先级

**Phase 1: 基础框架 (1-2周)**
1. 底部面板容器组件
2. 三栏布局基础结构
3. 模式切换机制
4. 展开/折叠动画

**Phase 2: 核心功能 (2-3周)**
1. 单位概览面板
2. 系统状态面板
3. 航向角控制组件
4. 距离控制组件

**Phase 3: 高级功能 (2-3周)**
1. 武器挂载面板
2. 舰船操作模式完整实现
3. 全局视图模式
4. 详细展开面板

**Phase 4: 优化完善 (1-2周)**
1. 响应式适配
2. 动画优化
3. 性能调优
4. 可访问性支持

### 技术要点

1. **性能优化**
   - 使用 `React.memo` 避免不必要的重渲染
   - 状态更新使用 `useCallback` 和 `useMemo`
   - 大量数据使用虚拟列表

2. **样式管理**
   - 使用 CSS Modules 或 Styled Components
   - 建立统一的 Design Tokens
   - 避免内联样式，使用 CSS 变量

3. **交互体验**
   - 所有交互提供视觉反馈
   - 错误操作有明确提示
   - 支持键盘快捷键

4. **可测试性**
   - 组件职责单一
   - 纯函数组件优先
   - 业务逻辑与UI分离

---

## 🎮 用户交互流程

### 典型使用场景

**场景1: 移动舰船**
1. 点击舰船选中 → 底部面板切换为舰船模式
2. 在航向角控制中设置目标方向
3. 在距离控制中设置移动距离
4. 查看路径预览
5. 点击确认移动

**场景2: 发射武器**
1. 选中舰船 → 显示武器挂载面板
2. 点击选择武器
3. 点击目标（或在画布上选择）
4. 查看命中概率和预计伤害
5. 点击开火

**场景3: 查看全局状态**
1. 点击空白处取消选中
2. 底部面板切换为全局视图
3. 查看回合进度和玩家状态
4. 查看系统消息历史

---

## ✅ 验收标准

### 功能验收
- [ ] 根据选中对象类型正确切换面板模式
- [ ] 航向角控制支持多种输入方式
- [ ] 距离控制实时计算并显示预览
- [ ] 武器系统状态正确显示
- [ ] 系统状态条实时更新
- [ ] 展开/折叠动画流畅

### 视觉验收
- [ ] 整体风格统一，圆角使用符合规范
- [ ] 颜色使用符合设计系统
- [ ] 动画流畅，无卡顿
- [ ] 响应式布局在各断点正常

### 性能验收
- [ ] 面板切换无卡顿
- [ ] 状态更新流畅（60fps）
- [ ] 内存使用合理，无泄漏

---

*文档版本: 1.0*
*最后更新: 2026-03-15*
*作者: AI Assistant*
