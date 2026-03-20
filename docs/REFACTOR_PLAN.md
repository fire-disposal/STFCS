# STFCS 项目重构计划

> 生成时间：2026年3月20日
> 状态：阶段一已完成，阶段二-七待执行

---

## 一、审查发现的核心问题

### 1.1 产品闭环断裂点

| 问题 | 严重程度 | 说明 |
|------|----------|------|
| **部署阶段无入口** | 🔴 致命 | `GameFlowService.startDeployment()` 只是状态切换，前端无创建舰船的UI |
| **三阶段移动未实现** | 🔴 致命 | 玩法要求"平移A→转向→平移B"，当前只支持单次移动 |
| **攻击流程无法操作** | 🔴 致命 | 无目标选择、无武器选择、无象限选择 |

### 1.2 Token交互核心缺失

- `TokenInfo.metadata` 无标准武器数据结构，导致 `WeaponRangeRenderer` 永远不渲染
- 护甲象限数据不存在，`createArmorQuadrantsIndicator()` 永远不执行
- DM无法创建敌方单位，`enemyUnits` 永远为空数组

---

## 二、新架构设计

### 2.1 核心数据流

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           前端架构                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │ 部署阶段UI  │───▶│ 舰船选择器  │───▶│ Token创建器 │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│         │                  │                  │                         │
│         ▼                  ▼                  ▼                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Redux Store (统一状态)                        │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │   │
│  │  │ mapSlice  │ │ shipSlice │ │combatSlice│ │ gameSlice │       │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                  │                  │                         │
│         ▼                  ▼                  ▼                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │ 移动控制器  │    │ 战斗交互器  │    │ 状态渲染器  │                 │
│  │ (三阶段)    │    │ (目标/武器) │    │ (护甲/辐能) │                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           后端架构                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │ TokenFactory│───▶│ ShipFactory │───▶│CombatService│                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 三、文件变更清单

### 3.1 新增文件 (共 23 个)

#### 共享层 (shared)

| 文件路径 | 用途 | 状态 |
|----------|------|------|
| `packages/shared/src/types/token-v2.ts` | 新Token数据结构定义 | ✅ 已完成 |
| `packages/shared/src/types/weapon-instance.ts` | 武器实例类型定义 | ✅ 已完成 |
| `packages/shared/src/types/combat-state.ts` | 战斗状态类型定义 | ✅ 已完成 |
| `packages/shared/src/types/movement-phase.ts` | 三阶段移动类型定义 | ✅ 已完成 |
| `packages/shared/src/protocol/DeploymentProtocol.ts` | 部署阶段消息协议 | ⏳ 待创建 |
| `packages/shared/src/protocol/CombatProtocol.ts` | 战斗交互消息协议 | ⏳ 待创建 |

#### 前端 (client)

| 文件路径 | 用途 | 状态 |
|----------|------|------|
| `packages/client/src/features/deployment/DeploymentPhaseView.tsx` | 部署阶段主视图 | ⏳ 待创建 |
| `packages/client/src/features/deployment/ShipSelector.tsx` | 舰船选择器组件 | ⏳ 待创建 |
| `packages/client/src/features/deployment/ShipPlacementPreview.tsx` | 舰船放置预览 | ⏳ 待创建 |
| `packages/client/src/features/deployment/FactionDeploymentPanel.tsx` | 阵营部署面板 | ⏳ 待创建 |
| `packages/client/src/features/combat/TargetSelector.tsx` | 目标选择器组件 | ⏳ 待创建 |
| `packages/client/src/features/combat/WeaponSelector.tsx` | 武器选择器组件 | ⏳ 待创建 |
| `packages/client/src/features/combat/QuadrantSelector.tsx` | 象限选择器组件 | ⏳ 待创建 |
| `packages/client/src/features/combat/AttackPreview.tsx` | 攻击预览组件 | ⏳ 待创建 |
| `packages/client/src/features/movement/ThreePhaseMovementController.tsx` | 三阶段移动控制器 | ⏳ 待创建 |
| `packages/client/src/features/movement/MovementPhaseIndicator.tsx` | 移动阶段指示器 | ⏳ 待创建 |
| `packages/client/src/features/ship/ArmorQuadrantDisplay.tsx` | 护甲象限显示组件 | ⏳ 待创建 |
| `packages/client/src/features/ship/FluxSystemDisplay.tsx` | 辐能系统显示组件 | ⏳ 待创建 |
| `packages/client/src/features/dm/EnemyUnitCreator.tsx` | 敌方单位创建器 | ⏳ 待创建 |
| `packages/client/src/store/slices/deploymentSlice.ts` | 部署阶段状态管理 | ⏳ 待创建 |
| `packages/client/src/store/slices/combatUISlice.ts` | 战斗UI状态管理 | ⏳ 待创建 |

#### 后端 (server)

| 文件路径 | 用途 | 状态 |
|----------|------|------|
| `packages/server/src/application/deployment/DeploymentService.ts` | 部署阶段服务 | ⏳ 待创建 |
| `packages/server/src/application/deployment/TokenFactory.ts` | Token创建工厂 | ⏳ 待创建 |

### 3.2 重写文件 (共 15 个)

| 文件路径 | 重写原因 | 状态 |
|----------|----------|------|
| `packages/shared/src/core-types.ts` | 更新TokenInfo为V2版本 | ⏳ 待重写 |
| `packages/server/src/domain/ship/Ship.ts` | 实现三阶段移动系统 | ⏳ 待重写 |
| `packages/server/src/domain/weapon/DamageCalculator.ts` | 实现正确的伤害公式 | ⏳ 待重写 |
| `packages/server/src/application/combat/CombatService.ts` | 添加象限选择、伤害预览 | ⏳ 待重写 |
| `packages/server/src/application/action/ActionService.ts` | 重构行动系统支持三阶段移动 | ⏳ 待重写 |
| `packages/server/src/application/game/GameFlowService.ts` | 完善部署阶段逻辑 | ⏳ 待重写 |
| `packages/server/src/application/ship/ShipService.ts` | 添加从定义创建舰船的方法 | ⏳ 待重写 |
| `packages/client/src/features/ui/TacticalCommandPanel.tsx` | 实现真实的移动/武器控制 | ⏳ 待重写 |
| `packages/client/src/features/game/layers/TokenRenderer.ts` | 渲染武器挂载点、护甲象限 | ⏳ 待重写 |
| `packages/client/src/features/game/layers/WeaponRangeRenderer.ts` | 从Token武器数据渲染 | ⏳ 待重写 |
| `packages/client/src/store/slices/shipSlice.ts` | 支持新的舰船状态结构 | ⏳ 待重写 |
| `packages/client/src/store/slices/mapSlice.ts` | 支持TokenV2数据结构 | ⏳ 待重写 |
| `packages/client/src/features/ui/DMControlPanel.tsx` | 添加敌方单位创建功能 | ⏳ 待重写 |
| `packages/client/src/features/ui/RightInfoPanel.tsx` | 添加护甲/辐能详细显示 | ⏳ 待重写 |
| `packages/client/src/hooks/useTokenSelection.ts` | 支持武器/象限选择 | ⏳ 待重写 |

### 3.3 删除文件 (共 3 个)

| 文件路径 | 删除原因 | 状态 |
|----------|----------|------|
| `packages/server/src/domain/weapon/Weapon.ts` | 与WeaponDefinition重复，统一使用shared定义 | ⏳ 待删除 |
| `packages/client/src/features/game/components/TokenAddons.ts` | 拆分为独立组件 | ⏳ 待删除 |
| `packages/shared/src/config/defaults.ts` | 移动到assets目录作为JSON配置 | ⏳ 待删除 |

---

## 四、详细修复步骤

### 阶段一：数据结构重构 ✅ 已完成

**状态**: 已完成

**创建的文件**:
- `packages/shared/src/types/token-v2.ts`
- `packages/shared/src/types/weapon-instance.ts`
- `packages/shared/src/types/combat-state.ts`
- `packages/shared/src/types/movement-phase.ts`
- 更新 `packages/shared/src/types/index.ts`

---

### 阶段二：后端核心逻辑重构 ⏳ 待执行

#### 步骤 2.1：重写 Ship.ts 实现三阶段移动

**文件**: `packages/server/src/domain/ship/Ship.ts`

**关键修改点**:

```typescript
// 导入新类型
import type { MovementState, MovementAction, MovementType, MovementValidation } from '@vt/shared/types';
import { createDefaultMovementState, resetMovementState, canExecutePhase } from '@vt/shared/types';

// 新增移动状态字段
private _movementState: MovementState;

// 构造函数中初始化
constructor(config: ShipConfig) {
  // ... 现有代码 ...
  this._movementState = createDefaultMovementState(config.speed, config.maneuverability);
}

// 新增方法：执行阶段移动
executePhaseMovement(command: MovementAction): MovementValidation {
  // 1. 验证舰船状态（过载/排散中不能移动）
  if (this._isShipDisabled()) {
    return { valid: false, reason: 'Ship is disabled' };
  }
  
  // 2. 验证阶段顺序
  if (!canExecutePhase(this._movementState, command.phase)) {
    return { valid: false, reason: `Cannot execute phase ${command.phase} now` };
  }
  
  // 3. 根据阶段执行移动
  switch (command.phase) {
    case 1:
      return this._executePhase1(command);
    case 2:
      return this._executePhase2(command);
    case 3:
      return this._executePhase3(command);
    default:
      return { valid: false, reason: 'Invalid phase' };
  }
}

// 阶段1：平移
private _executePhase1(command: MovementAction): MovementValidation {
  const { type, distance } = command;
  
  // 验证距离
  const maxDistance = type === 'strafe_left' || type === 'strafe_right'
    ? this._speed
    : this._speed * 2;
    
  if (distance > maxDistance) {
    return { valid: false, reason: `Distance exceeds maximum ${maxDistance}` };
  }
  
  // 执行移动
  this._applyMovement(type, distance);
  
  // 更新状态
  this._movementState.phase1Complete = true;
  this._movementState.currentPhase = 2;
  
  return { valid: true };
}

// 阶段2：转向
private _executePhase2(command: MovementAction): MovementValidation {
  const { angle } = command;
  
  if (Math.abs(angle) > this._maneuverability) {
    return { valid: false, reason: `Rotation exceeds maximum ${this._maneuverability}` };
  }
  
  this._heading = ((this._heading + angle) % 360 + 360) % 360;
  
  this._movementState.phase2Complete = true;
  this._movementState.currentPhase = 3;
  
  return { valid: true };
}

// 阶段3：平移（沿新朝向）
private _executePhase3(command: MovementAction): MovementValidation {
  // 与阶段1类似，但沿新朝向
  // ...
  
  this._movementState.phase3Complete = true;
  return { valid: true };
}

// 重置移动阶段（新回合开始）
resetMovementPhase(): void {
  this._movementState = resetMovementState(this._movementState);
}

// 获取移动状态
getMovementState(): MovementState {
  return { ...this._movementState };
}
```

#### 步骤 2.2：重写 DamageCalculator.ts

**文件**: `packages/server/src/domain/weapon/DamageCalculator.ts`

**关键修改点**:

```typescript
// 伤害类型修正系数（按玩法文档）
private static readonly DAMAGE_MODIFIERS = {
  KINETIC: { shield: 2.0, armor: 0.5, hull: 1.0, armorPenetration: 0.5 },
  HIGH_EXPLOSIVE: { shield: 0.5, armor: 2.0, hull: 1.0, armorPenetration: 2.0 },
  FRAGMENTATION: { shield: 0.25, armor: 0.25, hull: 1.0, armorPenetration: 0.25 },
  ENERGY: { shield: 1.0, armor: 1.0, hull: 1.0, armorPenetration: 1.0 },
};

// 最大减伤比例
private static readonly MAX_REDUCTION_RATIO = 0.85;
// 最小伤害比例
private static readonly MIN_DAMAGE_RATIO = 0.15;

static calculateDamage(input: DamageCalculationInput): DamageCalculationResult {
  const { weapon, sourceShip, targetShip, hitPosition, selectedQuadrant } = input;
  
  // 1. 获取武器定义的伤害类型修正
  const modifiers = this.DAMAGE_MODIFIERS[weapon.damageType];
  
  // 2. 计算基础伤害
  const baseDamage = weapon.damage;
  
  // 3. 护盾阶段
  let remainingDamage = baseDamage;
  let shieldAbsorbed = 0;
  let hardFluxGenerated = 0;
  
  const shield = targetShip.shield;
  if (shield?.isActive && this._isHitOnShield(sourceShip, targetShip)) {
    const shieldDamage = baseDamage * modifiers.shield * shield.efficiency;
    shieldAbsorbed = Math.min(shieldDamage, remainingDamage);
    hardFluxGenerated = shieldAbsorbed * shield.efficiency;
    remainingDamage -= shieldAbsorbed;
  }
  
  // 4. 护甲阶段
  const quadrant = selectedQuadrant ?? this.determineHitQuadrant(hitPosition, targetShip);
  const armorQuadrant = targetShip.getArmorQuadrant(quadrant);
  
  let armorReduced = 0;
  let hullDamage = 0;
  
  if (armorQuadrant && remainingDamage > 0) {
    const armorValue = armorQuadrant.value;
    const armorPenetration = baseDamage * modifiers.armorPenetration;
    const minArmor = armorQuadrant.maxValue * this.MIN_DAMAGE_RATIO;
    const effectiveArmor = Math.max(armorValue, minArmor);
    
    // 伤害公式：D = X * Z / (Z + C)
    let calculatedDamage = baseDamage * armorPenetration / (armorPenetration + effectiveArmor);
    
    // 减伤上限检查
    const reductionRatio = (baseDamage - calculatedDamage) / baseDamage;
    if (reductionRatio > this.MAX_REDUCTION_RATIO) {
      calculatedDamage = baseDamage * (1 - this.MAX_REDUCTION_RATIO);
    }
    
    armorReduced = Math.min(armorValue, calculatedDamage * 0.5);
    hullDamage = calculatedDamage - armorReduced;
    remainingDamage = 0;
  } else if (remainingDamage > 0) {
    hullDamage = remainingDamage;
  }
  
  // 5. 辐能计算
  const softFluxGenerated = weapon.fluxCost;
  
  return {
    hit: true,
    damage: baseDamage,
    shieldAbsorbed,
    armorReduced,
    hullDamage,
    hitQuadrant: quadrant,
    softFluxGenerated,
    hardFluxGenerated,
  };
}
```

#### 步骤 2.3：创建 TokenFactory.ts

**文件**: `packages/server/src/application/deployment/TokenFactory.ts`

```typescript
import type { ShipDefinition, HullDefinition, WeaponDefinition } from '@vt/shared/config';
import type { TokenInfoV2, WeaponInstanceState, ArmorInstanceState, ShieldInstanceState, FluxInstanceState } from '@vt/shared/types';
import { v4 as uuidv4 } from 'uuid';

export interface TokenFactoryDeps {
  getShipDefinition(id: string): ShipDefinition | undefined;
  getHullDefinition(id: string): HullDefinition | undefined;
  getWeaponDefinition(id: string): WeaponDefinition | undefined;
}

export class TokenFactory {
  constructor(private readonly deps: TokenFactoryDeps) {}

  /**
   * 从舰船定义创建完整的Token实例
   */
  createShipToken(params: {
    shipDefinitionId: string;
    ownerId: string;
    faction: FactionId;
    position: Point;
    heading: number;
    name?: string;
  }): TokenInfoV2 | null {
    const shipDef = this.deps.getShipDefinition(params.shipDefinitionId);
    if (!shipDef) return null;

    const hullDef = this.deps.getHullDefinition(shipDef.hullId);
    if (!hullDef) return null;

    const tokenId = `ship_${uuidv4()}`;

    // 构建武器实例
    const weapons = this._buildWeaponInstances(shipDef.weaponLoadout, hullDef);

    // 构建护甲实例
    const armor = this._buildArmorInstance(hullDef);

    // 构建护盾实例
    const shield = this._buildShieldInstance(hullDef);

    // 构建辐能实例
    const flux = this._buildFluxInstance(hullDef);

    // 构建船体实例
    const hull = {
      max: hullDef.hitPoints,
      current: hullDef.hitPoints,
    };

    return {
      id: tokenId,
      ownerId: params.ownerId,
      faction: params.faction,
      position: params.position,
      heading: params.heading,
      type: 'ship',
      size: hullDef.collisionRadius,
      scale: hullDef.spriteScale,
      collisionRadius: hullDef.collisionRadius,
      layer: 1,
      shipDefinitionId: params.shipDefinitionId,
      hullId: shipDef.hullId,
      
      movement: {
        maxSpeed: hullDef.maxSpeed,
        maxTurnRate: hullDef.maxTurnRate,
        currentPhase: 1,
        phase1Complete: false,
        phase2Complete: false,
        phase3Complete: false,
        remainingSpeed: hullDef.maxSpeed * 2,
        remainingTurn: hullDef.maxTurnRate,
      },
      
      actions: {
        perTurn: 3,
        remaining: 3,
        hasMoved: false,
        hasFired: false,
        hasVented: false,
        hasToggledShield: false,
      },
      
      turnState: 'waiting',
      weapons,
      armor,
      shield,
      flux,
      hull,
      spriteId: hullDef.sprite,
    };
  }

  private _buildWeaponInstances(
    loadout: Record<string, string>,
    hullDef: HullDefinition
  ): WeaponInstanceState[] {
    const weapons: WeaponInstanceState[] = [];

    for (const slot of hullDef.weaponSlots) {
      const weaponId = loadout[slot.id];
      if (!weaponId) continue;

      const weaponDef = this.deps.getWeaponDefinition(weaponId);
      if (!weaponDef) continue;

      weapons.push({
        mountId: slot.id,
        weaponId: weaponId,
        name: weaponDef.name,
        damageType: weaponDef.damageType,
        damage: weaponDef.damage,
        range: weaponDef.range,
        arc: slot.arc,
        mountType: slot.type,
        position: slot.position,
        facing: slot.facing,
        cooldown: weaponDef.cooldown,
        currentCooldown: 0,
        canFire: true,
        fluxCost: weaponDef.fluxCost,
      });
    }

    return weapons;
  }

  private _buildArmorInstance(hullDef: HullDefinition): ArmorInstanceState {
    const quadrants = hullDef.armor.quadrants ?? {
      FRONT_TOP: hullDef.armor.maxValue,
      FRONT_BOTTOM: hullDef.armor.maxValue,
      LEFT_TOP: hullDef.armor.maxValue * 0.75,
      LEFT_BOTTOM: hullDef.armor.maxValue * 0.75,
      RIGHT_TOP: hullDef.armor.maxValue * 0.75,
      RIGHT_BOTTOM: hullDef.armor.maxValue * 0.75,
    };

    return {
      maxPerQuadrant: hullDef.armor.maxValue,
      quadrants,
    };
  }

  private _buildShieldInstance(hullDef: HullDefinition): ShieldInstanceState {
    if (!hullDef.shield) {
      return {
        type: 'FRONT',
        active: false,
        radius: 0,
        coverageAngle: 0,
        efficiency: 1,
        centerOffset: { x: 0, y: 0 },
        orientation: 0,
        maintenanceCost: 0,
      };
    }

    return {
      type: hullDef.shield.type === 'OMNI' ? 'OMNI' : 'FRONT',
      active: false,
      radius: hullDef.shield.radius,
      coverageAngle: hullDef.shield.coverageAngle,
      efficiency: hullDef.shield.efficiency,
      centerOffset: hullDef.shield.centerOffset,
      orientation: 0,
      maintenanceCost: hullDef.shield.maintenanceCost,
    };
  }

  private _buildFluxInstance(hullDef: HullDefinition): FluxInstanceState {
    return {
      capacity: hullDef.flux.capacity,
      dissipation: hullDef.flux.dissipation,
      softFlux: 0,
      hardFlux: 0,
      state: 'normal',
    };
  }
}
```

---

### 阶段三：前端部署阶段UI ⏳ 待执行

#### 步骤 3.1：创建部署阶段视图

**文件**: `packages/client/src/features/deployment/DeploymentPhaseView.tsx`

```typescript
import React from 'react';
import { useAppSelector, useAppDispatch } from '@/store';
import { ShipSelector } from './ShipSelector';
import { ShipPlacementPreview } from './ShipPlacementPreview';
import { FactionDeploymentPanel } from './FactionDeploymentPanel';
import { GameCanvas } from '@/components/map/GameCanvas';
import { websocketService } from '@/services/websocket';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';

export const DeploymentPhaseView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { phase, deploymentReady } = useAppSelector((state) => state.gameFlow);
  const { selectedFaction } = useAppSelector((state) => state.faction);
  const { placementMode, placementPreview } = useAppSelector((state) => state.map);
  const currentPlayerId = useAppSelector((state) => state.player.currentPlayerId);

  if (phase !== 'deployment') return null;

  const handleShipSelect = (shipDefinitionId: string) => {
    dispatch(setPlacementMode(true));
    dispatch(setPlacementShip(shipDefinitionId));
  };

  const handlePlacementConfirm = (position: Point, heading: number) => {
    websocketService.send({
      type: WS_MESSAGE_TYPES.DEPLOY_SHIP,
      payload: {
        shipDefinitionId: placementPreview?.shipDefinitionId,
        position,
        heading,
        faction: selectedFaction,
        ownerId: currentPlayerId,
      },
    });
  };

  const handleReadyToggle = () => {
    websocketService.send({
      type: WS_MESSAGE_TYPES.DEPLOYMENT_READY,
      payload: {
        faction: selectedFaction,
        playerId: currentPlayerId,
        ready: !deploymentReady[selectedFaction],
      },
    });
  };

  return (
    <div className="deployment-view">
      <aside className="deployment-sidebar">
        <ShipSelector faction={selectedFaction} onSelect={handleShipSelect} />
        <FactionDeploymentPanel 
          onReadyToggle={handleReadyToggle}
          isReady={deploymentReady[selectedFaction]}
        />
      </aside>
      <main className="deployment-canvas">
        <GameCanvas />
        {placementMode && <ShipPlacementPreview onConfirm={handlePlacementConfirm} />}
      </main>
      <aside className="deployment-status">
        <DeploymentStatusPanel />
      </aside>
    </div>
  );
};
```

#### 步骤 3.2：创建舰船选择器

**文件**: `packages/client/src/features/deployment/ShipSelector.tsx`

```typescript
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getAssetRegistry } from '@/services/AssetRegistry';
import type { ShipDefinition, FactionId } from '@vt/shared/types';

interface ShipSelectorProps {
  faction: FactionId;
  onSelect: (shipDefinitionId: string) => void;
}

export const ShipSelector: React.FC<ShipSelectorProps> = ({ faction, onSelect }) => {
  const { t, i18n } = useTranslation();
  const registry = getAssetRegistry();

  const availableShips = useMemo(() => {
    const allShips = registry.getAllShips();
    return allShips.filter(ship => ship.faction === faction || !ship.faction);
  }, [registry, faction]);

  return (
    <div className="ship-selector">
      <h3 className="ship-selector-title">{t('deployment.selectShip')}</h3>
      <div className="ship-list">
        {availableShips.map((ship) => (
          <ShipCard key={ship.id} ship={ship} onClick={() => onSelect(ship.id)} />
        ))}
      </div>
    </div>
  );
};
```

---

### 阶段四：前端战斗交互UI ⏳ 待执行

#### 步骤 4.1：创建目标选择器

**文件**: `packages/client/src/features/combat/TargetSelector.tsx`

#### 步骤 4.2：创建三阶段移动控制器

**文件**: `packages/client/src/features/movement/ThreePhaseMovementController.tsx`

---

### 阶段五：前端状态管理更新 ⏳ 待执行

#### 步骤 5.1：创建部署阶段Slice

**文件**: `packages/client/src/store/slices/deploymentSlice.ts`

#### 步骤 5.2：创建战斗UI Slice

**文件**: `packages/client/src/store/slices/combatUISlice.ts`

---

### 阶段六：更新渲染层 ⏳ 待执行

#### 步骤 6.1：更新 TokenRenderer.ts

**文件**: `packages/client/src/features/game/layers/TokenRenderer.ts`

**关键修改点**:
- 渲染武器挂载点指示器
- 渲染护甲象限（选中时）
- 从TokenV2数据渲染

---

### 阶段七：集成测试与清理 ⏳ 待执行

1. 删除过时文件
2. 更新导出
3. 运行编译测试
4. 运行功能测试

---

## 五、WebSocket消息协议扩展

### 新增消息类型

```typescript
export const WS_MESSAGE_TYPES = {
  // ... 现有类型 ...

  // 部署阶段
  DEPLOY_SHIP: 'DEPLOY_SHIP',
  DEPLOY_SHIP_RESULT: 'DEPLOY_SHIP_RESULT',
  DEPLOYMENT_READY: 'DEPLOYMENT_READY',
  DEPLOYMENT_START: 'DEPLOYMENT_START',
  DEPLOYMENT_COMPLETE: 'DEPLOYMENT_COMPLETE',
  REMOVE_DEPLOYED_SHIP: 'REMOVE_DEPLOYED_SHIP',

  // 三阶段移动
  SHIP_MOVE_PHASE: 'SHIP_MOVE_PHASE',
  SHIP_MOVE_PHASE_RESULT: 'SHIP_MOVE_PHASE_RESULT',
  SHIP_END_MOVEMENT_PHASE: 'SHIP_END_MOVEMENT_PHASE',

  // 战斗交互
  SELECT_TARGET: 'SELECT_TARGET',
  SELECT_QUADRANT: 'SELECT_QUADRANT',
  SELECT_WEAPON: 'SELECT_WEAPON',
  ATTACK_PREVIEW_REQUEST: 'ATTACK_PREVIEW_REQUEST',
  ATTACK_PREVIEW_RESULT: 'ATTACK_PREVIEW_RESULT',
  CONFIRM_ATTACK: 'CONFIRM_ATTACK',

  // 敌方单位
  CREATE_ENEMY_UNIT: 'CREATE_ENEMY_UNIT',
  UPDATE_ENEMY_UNIT: 'UPDATE_ENEMY_UNIT',
  DELETE_ENEMY_UNIT: 'DELETE_ENEMY_UNIT',
} as const;
```

---

## 六、实施顺序与时间估计

| 阶段 | 内容 | 预计时间 | 依赖 | 状态 |
|------|------|----------|------|------|
| 1 | 数据结构重构 | 1天 | 无 | ✅ 完成 |
| 2 | 后端核心逻辑 | 2天 | 阶段1 | ⏳ 待执行 |
| 3 | 前端部署UI | 1.5天 | 阶段1 | ⏳ 待执行 |
| 4 | 前端战斗UI | 1.5天 | 阶段2 | ⏳ 待执行 |
| 5 | 状态管理更新 | 0.5天 | 阶段1 | ⏳ 待执行 |
| 6 | 渲染层更新 | 1天 | 阶段4,5 | ⏳ 待执行 |
| 7 | 集成测试 | 1天 | 全部 | ⏳ 待执行 |

**总计**: 约 8.5 天

---

## 七、执行命令

当准备继续执行时，使用以下命令：

```
# 阶段二：后端核心逻辑重构
task: 重写Ship.ts实现三阶段移动系统
task: 重写DamageCalculator.ts实现正确伤害公式
task: 创建TokenFactory.ts

# 阶段三：前端部署阶段UI
task: 创建DeploymentPhaseView.tsx
task: 创建ShipSelector.tsx
task: 创建ShipPlacementPreview.tsx

# 阶段四：前端战斗交互UI
task: 创建TargetSelector.tsx
task: 创建ThreePhaseMovementController.tsx

# 阶段五：状态管理更新
task: 创建deploymentSlice.ts
task: 创建combatUISlice.ts

# 阶段六：渲染层更新
task: 更新TokenRenderer.ts

# 阶段七：清理
task: 删除过时文件
task: 运行编译测试
```