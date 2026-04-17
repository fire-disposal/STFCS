# 舰船自定义系统设计文档

> **版本**: 1.0
> **文档性质**: 技术设计文档
> **创建日期**: 2026-04-17
> **相关文档**: game-design-document.md, issues.md

---

## 一、系统概述

### 1.1 设计理念

**核心原则**：
- 舰船实例与模板**语义平等**，不引入"变体"概念
- 支持**高自由度**自定义，依赖DM人工审查而非程序硬限制
- 所有属性可编辑，包括添加/删除武器挂点
- 支持自定义贴图导入、透明色设置、贴图定位

### 1.2 功能范围

| 功能模块 | 描述 |
|---------|------|
| **基础属性编辑** | 名称、尺寸、派系、位置、朝向 |
| **生存属性编辑** | 结构值、六象限护甲（可视化）、护甲配置 |
| **辐能系统编辑** | 辐能容量、散逸率、当前值（软/硬辐能） |
| **护盾系统编辑** | 类型、覆盖角度、效率、半径 |
| **机动属性编辑** | 最大航速、转向速度 |
| **武器挂点管理** | 添加、删除、编辑挂点属性 |
| **贴图管理** | URL/上传导入、透明色设置、定位调整 |
| **武器自定义** | 独立武器自定义面板 |

### 1.3 用户角色权限

| 角色 | 权限 |
|------|------|
| **DM** | 所有舰船的完整编辑权限 |
| **玩家** | 仅己方舰船，部署阶段可编辑 |

---

## 二、数据模型扩展

### 2.1 舰船实例数据结构

```typescript
/**
 * 舰船实例（支持完全自定义）
 *
 * - hullType: 原型模板ID，可为 "custom" 表示完全自定义
 * - 所有属性均可编辑，不受模板限制
 */
interface ShipInstance {
  // === 基本信息 ===
  id: string;
  name: string;
  hullType: string;              // 原型模板ID，可选，可设为 "custom"
  size: HullSizeValue;           // FRIGATE/DESTROYER/CRUISER/CAPITAL
  
  // === 外观配置 ===
  texture: TextureConfig;        // 贴图配置
  width: number;                 // 船体宽度（渲染范围）
  length: number;                // 船体长度（渲染范围）
  
  // === 生存属性 ===
  hullPointsMax: number;
  hullPointsCurrent: number;
  armorMaxPerQuadrant: number;   // 单象限护甲上限
  armorQuadrants: [number, number, number, number, number, number]; // 六象限当前值
  armorMinReductionRatio: number; // 最小护甲减伤比
  armorMaxReductionRatio: number; // 最大护甲减伤比
  
  // === 辐能系统 ===
  fluxCapacityMax: number;       // 辐能容量上限
  fluxDissipation: number;       // 每回合散逸量
  fluxSoftCurrent: number;       // 当前软辐能
  fluxHardCurrent: number;       // 当前硬辐能
  
  // === 护盾系统 ===
  shieldType: ShieldTypeValue;   // FRONT/OMNI/NONE
  shieldArc: number;             // 覆盖角度
  shieldEfficiency: number;      // 效率倍率
  shieldRadius: number;          // 护盾半径
  shieldUpCost: number;          // 每回合维持成本
  shieldActive: boolean;         // 当前状态
  shieldOrientation: number;     // 当前朝向（全盾）
  
  // === 机动属性 ===
  maxSpeed: number;              // 每阶段最大移动距离
  maxTurnRate: number;           // 每回合最大转向角度
  heading: number;               // 当前船头朝向
  position: Point;               // 当前位置
  
  // === 武器挂点（可自由定义） ===
  weaponMounts: CustomWeaponMount[];
  
  // === 其他 ===
  faction: FactionValue;         // 派系
  ownerId: string;               // 所有者
  opCapacity?: number;           // OP容量（可选，DM可选择是否启用）
  rangeModifier: number;         // 射程修正（默认1.0）
  pluginSlots?: PluginSlot[];    // 插件栏位
}

/**
 * 贴图配置
 */
interface TextureConfig {
  sourceType: "url" | "uploaded" | "preset" | "none";
  source: string;                // URL 或 Base64 数据
  transparentColor?: string;     // 透明色（如 "#FFFFFF"）
  transparencyTolerance?: number;// 透明色容差（0-255）
  offsetX: number;               // 贴图偏移X（用于对齐中心点）
  offsetY: number;               // 贴图偏移Y
  scale: number;                 // 缩放比例
}

/**
 * 自定义武器挂点
 */
interface CustomWeaponMount {
  id: string;
  displayName?: string;          // 挂载点显示名称
  position: Point;               // 相对舰船中心
  facing: number;                // 基准朝向（度）
  arc: number;                   // 射界角度（炮塔型）
  hardpointArc?: number;         // 硬点型射界（默认20°）
  size: WeaponSlotSizeValue;     // SMALL/MEDIUM/LARGE
  mountType: "turret" | "hardpoint"; // 武器形态
  slotCategory: SlotCategoryValue;   // 类别限制
  acceptsTurret: boolean;        // 是否接受炮塔型
  acceptsHardpoint: boolean;     // 是否接受硬点型
  builtin: boolean;              // 内置武器标记（不可更换）
  currentWeaponId?: string;      // 当前安装的武器ID
}

/**
 * 插件栏位
 */
interface PluginSlot {
  id: string;
  name: string;
  description?: string;
}
```

### 2.2 武器实例数据结构

```typescript
/**
 * 武器实例（支持完全自定义）
 */
interface WeaponInstance {
  // === 基本信息 ===
  id: string;
  name: string;
  weaponType: string;            // 原型模板ID，可选
  category: WeaponCategoryValue; // BALLISTIC/ENERGY/MISSILE/SYNERGY
  size: WeaponSlotSizeValue;     // SMALL/MEDIUM/LARGE
  
  // === 伤害配置 ===
  damageType: DamageTypeValue;   // KINETIC/HIGH_EXPLOSIVE/ENERGY/FRAGMENTATION
  damagePerShot: number;         // 单发伤害
  projectilesPerShot: number;    // 射弹数
  
  // === 射程配置 ===
  range: number;                 // 最大射程
  minRange?: number;             // 最小射程
  arc: number;                   // 射界角度
  accuracy: number;              // 精确度（仅记录）
  
  // === 资源配置 ===
  fluxCost: number;              // 辐能消耗
  cooldown: number;              // 冷却时间（回合数）
  ammo?: number;                 // 弹药上限（可选）
  
  // === 特殊标记 ===
  isPD: boolean;                 // 点防御
  hasTracking: boolean;          // 制导
  ignoresShields: boolean;       // 穿盾
  
  // === 连发系统 ===
  burstSize?: number;            // 连发数（默认1）
  burstDelay?: number;           // 连发间隔（秒）
  
  // === 其他 ===
  empDamage?: number;            // EMP伤害
  opCost: number;                // OP成本
  description?: string;
  
  // === 外观 ===
  texture?: TextureConfig;       // 武器贴图（可选）
  icon?: string;                 // 图标
}
```

---

## 三、组件架构

### 3.1 组件层次结构

```
ShipCustomizationPanel（舰船自定义主面板）
│
├── PanelHeader                     # 面板头部（舰船名称、状态）
│
├── BasicInfoSection                # 基本信息区
│   ├── NameInput                   # 名称输入
│   ├── SizeSelector                # 尺寸选择
│   └── FactionSelector             # 派系选择
│
├── TextureSection                  # 贴图管理区
│   ├── TexturePreview              # 贴图预览
│   ├── TextureSourceSelector       # 来源选择（URL/上传/预设）
│   ├── TransparencyEditor          # 透明色设置
│   ├── PositioningEditor           # 贴图定位
│   └── ScaleEditor                 # 缩放调整
│
├── HullPropertySection             # 船体属性区
│   ├── HullPointsEditor            # 结构值编辑（当前/上限）
│   ├── ArmorEditor                 # 六象限护甲可视化编辑器
│   └── ArmorConfigEditor           # 护甲配置（上限、减伤比）
│
├── FluxSystemSection               # 辐能系统区
│   ├── FluxCapacityEditor          # 辐能容量上限
│   ├── FluxDissipationEditor       # 散逸率
│   ├── CurrentFluxEditor           # 当前值（软/硬辐能）
│   └── OverloadStatus              # 过载状态显示
│
├── ShieldSystemSection             # 护盾系统区
│   ├── ShieldTypeSelector          # 护盾类型
│   ├── ShieldArcEditor             # 覆盖角度
│   ├── ShieldEfficiencyEditor      # 效率
│   ├── ShieldRadiusEditor          # 护盾半径
│   └── ShieldUpCostEditor          # 维持成本
│
├── MobilitySection                 # 机动属性区
│   ├── MaxSpeedEditor              # 最大航速
│   ├── MaxTurnRateEditor           # 最大转向角度
│   └── PositionEditor              # 当前位置
│   └── HeadingEditor               # 当前朝向
│
├── WeaponMountSection              # 武器挂点管理区
│   ├── MountList                   # 挂点列表
│   ├── AddMountButton              # 添加挂点
│   ├── MountEditor                 # 挂点编辑（可视化）
│   └── WeaponSelectorPanel         # 武器选择面板（复用）
│
├── StatsSummarySection             # 配置摘要区
│   ├── FirepowerStats              # 火力统计
│   ├── SurvivalStats               # 生存统计
│   └── MobilityStats               # 机动统计
│
└── ActionButtons                   # 操作按钮
    ├── SaveButton                  # 保存修改
    ├── ResetButton                 # 重置为模板默认
    └── CloseButton                 # 关闭面板
```

### 3.2 子组件详情

#### 3.2.1 TextureSection（贴图管理区）

**功能需求**：
- 支持三种贴图来源：URL导入、本地上传、预设贴图
- 透明色设置：点击选择或手动输入
- 贴图定位：拖拽调整或精确输入偏移值
- 缩放调整：比例缩放

**交互流程**：
```
贴图管理
    │
    ├─► 选择来源类型
    │       ├─► URL: 输入URL → 加载预览
    │       ├─► Upload: 选择文件 → 转Base64 → 预览
    │       └─► Preset: 选择预设贴图
    │
    ├─► 透明色设置（可选）
    │       ├─► 点击贴图上的颜色 → 自动设为透明
    │       ├─► 手动输入颜色值（如 "#FFFFFF"）
    │       ├─► 容差调整（相近颜色透明范围）
    │       └─► 实时预览透明效果
    │
    ├─► 贴图定位
    │       ├─► 显示舰船中心点标记
    │       ├─► 拖拽贴图调整偏移
    │       ├─► 精确输入偏移值（X, Y）
    │       └─► 验证武器挂点位置对应
    │
    └► 缩放调整
            └► 滑块或输入比例值
```

#### 3.2.2 ArmorEditor（六象限护甲可视化编辑器）

**UI设计**：

```
六象限护甲编辑器：

        ┌─────── 船头 ───────┐
        │                    │
   ┌────┤  [前:100]  [前右:95] ├────┐
   │    │      ▲    ▲         │    │
   │    │   ┌──┴──┴──┐        │    │
   │    │   │ 中心点  │        │    │
   │[前左│   └───────┘   [后右]│    │
   │:80]│                :100 │    │
   │    │                    │    │
   └►───┤  [后左:100] [后:100]├──◄─┘
        │                    │
        └─────── 船尾 ────────┘

颜色编码：
  80-100% → 绿色 (#2ecc71)
  50-80%  → 黄色 (#f1c40f)
  20-50%  → 橙色 (#e67e22)
  0-20%   → 红色 (#e74c3c)
```

**交互方式**：
- 点击象限 → 弹出数值编辑器
- 悬停象限 → 显示详细数值
- 拖拽调整 → 快速修改比例
- 批量操作 → 重置全部、全部设置等

#### 3.2.3 WeaponMountSection（武器挂点管理）

**可视化编辑器**：

```
挂点可视化编辑界面：

┌─────────────────────────────────────────┐
│                [舰船贴图]                │
│                                          │
│         ●───[Mount 1]───►                │  ← 挂点标记 + 射界指示
│              (SMALL, Turret, 90°)        │
│                                          │
│              ⊕ [中心点]                   │  ← 中心点标记
│                                          │
│         ●───[Mount 2]───►                │
│              (MEDIUM, Hardpoint, 20°)    │
│                                          │
└─────────────────────────────────────────┘

右侧编辑面板：
┌─────────────────────────────────────────┐
│ 挂点编辑 - Mount 1                        │
│                                          │
│ 显示名称: [Main Gun    ]                 │
│ 位置 X:   [30]  Y: [-50]                 │
│ 朝向:     [0]°                           │
│ 射界:     [90]°                          │
│ 尺寸:     [SMALL ▼]                      │
│ 形态:     [炮塔 ▼]                        │
│ 类别:     [UNIVERSAL_SLOT ▼]             │
│                                          │
│ [拖拽调整位置] [删除挂点]                 │
└─────────────────────────────────────────┘
```

---

## 四、服务端命令扩展

### 4.1 新增命令

```typescript
// 舰船自定义命令
CMD_CUSTOMIZE_SHIP: "CMD_CUSTOMIZE_SHIP",        // 完整舰船自定义
CMD_ADD_WEAPON_MOUNT: "CMD_ADD_WEAPON_MOUNT",    // 添加武器挂点
CMD_REMOVE_WEAPON_MOUNT: "CMD_REMOVE_WEAPON_MOUNT", // 删除武器挂点
CMD_UPDATE_WEAPON_MOUNT: "CMD_UPDATE_WEAPON_MOUNT", // 更新挂点属性
CMD_SET_TEXTURE: "CMD_SET_TEXTURE",              // 设置贴图

// 武器自定义命令
CMD_CREATE_CUSTOM_WEAPON: "CMD_CREATE_CUSTOM_WEAPON", // 创建自定义武器
CMD_UPDATE_CUSTOM_WEAPON: "CMD_UPDATE_CUSTOM_WEAPON", // 更新武器属性
```

### 4.2 命令Payload定义

```typescript
interface CustomizeShipPayload {
  shipId: string;
  
  // 可选更新字段（仅发送需要更新的）
  name?: string;
  size?: HullSizeValue;
  width?: number;
  length?: number;
  
  hullPointsMax?: number;
  hullPointsCurrent?: number;
  armorMaxPerQuadrant?: number;
  armorQuadrants?: number[];
  armorMinReductionRatio?: number;
  armorMaxReductionRatio?: number;
  
  fluxCapacityMax?: number;
  fluxDissipation?: number;
  fluxSoftCurrent?: number;
  fluxHardCurrent?: number;
  
  shieldType?: ShieldTypeValue;
  shieldArc?: number;
  shieldEfficiency?: number;
  shieldRadius?: number;
  shieldUpCost?: number;
  
  maxSpeed?: number;
  maxTurnRate?: number;
  
  texture?: TextureConfig;
  weaponMounts?: CustomWeaponMount[];
  
  opCapacity?: number;
  rangeModifier?: number;
}

interface AddWeaponMountPayload {
  shipId: string;
  mount: CustomWeaponMount;
}

interface SetTexturePayload {
  shipId: string;
  texture: TextureConfig;
}
```

---

## 五、实施路线

### Phase 1: DM面板优化（当前）

1. **重构 DMControlPanel → DMObjectModificationPanel**
   - 分组展示舰船属性
   - 实现可视化护甲编辑器

2. **创建 ShipCustomizationPanel 框架**
   - 基础信息编辑区
   - 属性分组编辑区

### Phase 2: 贴图管理

1. **实现 TextureSection 组件**
   - URL/上传导入
   - 透明色设置
   - 贴图定位

### Phase 3: 武器挂点管理

1. **实现 WeaponMountSection**
   - 挂点列表展示
   - 添加/删除功能
   - 可视化挂点编辑器

### Phase 4: 武器自定义面板

1. **创建 WeaponCustomizationPanel**
   - 所有武器属性可编辑
   - 支持创建新武器

### Phase 5: 数据模型扩展

1. **扩展 Schema 类型**
   - 支持 TextureConfig
   - 支持 CustomWeaponMount

2. **实现服务端命令处理**
   - CustomizeShipHandler
   - TextureHandler

---

## 六、技术实现细节

### 6.1 贴图透明色处理

**Canvas实现方案**：

```typescript
function applyTransparency(
  imageData: ImageData,
  transparentColor: string,
  tolerance: number
): ImageData {
  const data = imageData.data;
  const targetRGB = hexToRGB(transparentColor);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // 计算颜色距离
    const distance = Math.sqrt(
      Math.pow(r - targetRGB.r, 2) +
      Math.pow(g - targetRGB.g, 2) +
      Math.pow(b - targetRGB.b, 2)
    );
    
    // 在容差范围内设为透明
    if (distance <= tolerance) {
      data[i + 3] = 0; // Alpha = 0
    }
  }
  
  return imageData;
}
```

### 6.2 六象限护甲可视化

**SVG实现方案**：

```typescript
// 六边形护甲图渲染
function renderArmorHexagon(
  container: HTMLElement,
  armorQuadrants: number[],
  maxArmor: number
) {
  // 使用SVG绘制六边形
  // 每个象限一个三角形区域
  // 颜色根据当前值/最大值比例计算
}
```

### 6.3 挂点可视化编辑

**拖拽交互实现**：

```typescript
// 挂点位置拖拽
function handleMountDrag(
  mountId: string,
  startPoint: Point,
  endPoint: Point
) {
  // 计算新位置（相对于中心点）
  const newPosition = {
    x: endPoint.x - shipCenter.x,
    y: endPoint.y - shipCenter.y
  };
  
  // 更新挂点位置
  updateMountPosition(mountId, newPosition);
  
  // 实时更新射界显示
  updateArcVisualization(mountId);
}
```

---

## 七、UI样式规范

### 7.1 颜色编码

| 用途 | 颜色 |
|------|------|
| DM面板主色 | #ff6f8f (粉红) |
| 面板背景 | rgba(6, 16, 26, 0.95) |
| 输入框背景 | rgba(26, 45, 66, 0.8) |
| 文字颜色 | #cfe8ff (浅蓝) |
| 护甲高值 | #2ecc71 (绿) |
| 护甲中值 | #f1c40f (黄) |
| 护甲低值 | #e74c3c (红) |
| 射界显示 | #4a9eff (蓝) |

### 7.2 字体规范

| 元素 | 字号 | 字重 |
|------|------|------|
| 面板标题 | 11px | bold |
| 区块标题 | 10px | bold |
| 属性标签 | 10px | normal |
| 数值显示 | 12px | normal |
| 按钮文字 | 10px | bold |

---

## 八、验收标准

### 8.1 功能验收

- [ ] DM可编辑舰船所有属性
- [ ] 支持贴图URL导入和本地上传
- [ ] 透明色设置生效且可预览
- [ ] 六象限护甲可视化编辑器可用
- [ ] 可添加/删除武器挂点
- [ ] 挂点位置可拖拽调整
- [ ] 武器选择面板正常工作

### 8.2 性能验收

- [ ] 贴图加载不超过 2秒
- [ ] 护甲编辑响应即时
- [ ] 挂点拖拽流畅无卡顿

### 8.3 兼容性验收

- [ ] 与现有WeaponSelectorPanel兼容
- [ ] 不影响现有舰船渲染逻辑
- [ ] 数据迁移平滑

---

> **文档维护说明**
> 本文档记录舰船自定义系统的技术设计。
> 实施过程中如有变更，请同步更新本文档。