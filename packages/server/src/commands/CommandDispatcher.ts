import { Client } from "@colyseus/core";
import { 
  angleBetween, 
  angleDifference,
  distance, 
  validateThreePhaseMove,
} from "@vt/rules";
import type { MoveTokenPayload, } from "../rooms/BattleRoom.js";
import { 
  DAMAGE_MULTIPLIERS,
  GAME_CONFIG, 
  GameRoomState, 
  PlayerRole,
  ShipState, 
  WeaponState
} from "../schema/GameSchema.js";

/**
 * 命令分发器 - 处理所有客户端指令的验证与执行
 */
export class CommandDispatcher {
  constructor(private state: GameRoomState | any) {}

  /**
   * 验证客户端对特定舰船的操作权限
   */
  private validateAuthority(client: Client, ship: ShipState): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      throw new Error("玩家未注册");
    }

    // DM 拥有最高权限
    if (player.role === PlayerRole.DM) {
      return;
    }

    // 检查阶段：玩家只能在 PLAYER_TURN 阶段操作
    if (this.state.currentPhase !== "PLAYER_TURN") {
      throw new Error("当前不是玩家行动回合");
    }

    // 检查拥有权
    if (ship.ownerId !== client.sessionId) {
      throw new Error("你没有权限操作这艘舰船");
    }

    // 检查是否已经结束回合
    if (player.isReady) {
      throw new Error("你已结束本回合，无法继续操作");
    }
  }

  /**
   * 处理移动指令 - 支持燃料池制度的三阶段移动
   * 
   * 燃料池规则：
   * - 阶段 A: 2X 前进燃料 + X 侧移燃料
   * - 阶段 B: Y 转向燃料
   * - 阶段 C: 2X 前进燃料 + X 侧移燃料
   * 
   * 增量移动：阶段内可任意次数消耗燃料进行移动
   */
  dispatchMoveToken(client: Client, payload: MoveTokenPayload): void {
    const { shipId, x, y, heading, movementPlan, phase, isIncremental } = payload;

    // 获取舰船
    const ship = this.state.ships.get(shipId);
    if (!ship) {
      throw new Error(`Ship ${shipId} not found`);
    }

    this.validateAuthority(client, ship);

    // 检查是否过载
    if (ship.isOverloaded) {
      throw new Error("Cannot move while overloaded");
    }

    // 增量移动模式：不检查 hasMoved，允许阶段内多次移动
    if (!isIncremental && ship.hasMoved) {
      throw new Error("Ship has already moved this turn");
    }

    const startX = ship.transform.x;
    const startY = ship.transform.y;
    const startHeading = ship.transform.heading;

    // 如果有详细的移动计划，使用三阶段移动验证
    if (movementPlan) {
      const validation = validateThreePhaseMove(
        startX, startY, startHeading,
        movementPlan,
        ship.maxSpeed,
        ship.maxTurnRate
      );
      
      if (!validation.valid) {
        throw new Error(validation.error || "Invalid movement");
      }
      
      // 记录移动参数（用于最终位置计算）
      ship.movePhaseAX = movementPlan.phaseAForward;
      ship.movePhaseAStrafe = movementPlan.phaseAStrafe;
      ship.turnAngle = movementPlan.turnAngle;
      ship.movePhaseBX = movementPlan.phaseBForward;
      ship.movePhaseBStrafe = movementPlan.phaseBStrafe;
      
      // 执行移动
      ship.transform.x = x;
      ship.transform.y = y;
      ship.transform.heading = heading;
      
      // 非增量移动：标记为已移动
      if (!isIncremental) {
        ship.hasMoved = true;
      }
      
      console.log(`Ship ${shipId} moved to (${x.toFixed(2)}, ${y.toFixed(2)}) heading ${heading.toFixed(2)}`);
      return;
    }

    // 增量移动：验证单步移动
    if (isIncremental) {
      // 计算移动距离
      const moveDistance = distance(startX, startY, x, y);
      
      // 验证转向角度
      const headingDiff = angleDifference(startHeading, heading);
      
      // 根据阶段验证移动
      const currentPhase = phase || 'PHASE_A';
      
      if (currentPhase === 'PHASE_A' || currentPhase === 'PHASE_C') {
        // 平移阶段：验证移动距离（单步不超过 maxSpeed）
        if (moveDistance > ship.maxSpeed) {
          throw new Error(`Incremental move distance ${moveDistance.toFixed(2)} exceeds single step limit ${ship.maxSpeed}`);
        }
        
        // 执行移动
        ship.transform.x = x;
        ship.transform.y = y;
        
      } else if (currentPhase === 'PHASE_B') {
        // 转向阶段：验证转向角度（单步不超过 maxTurnRate）
        if (headingDiff > ship.maxTurnRate) {
          throw new Error(`Incremental turn angle ${headingDiff.toFixed(2)} exceeds limit ${ship.maxTurnRate}`);
        }
        
        // 执行转向
        ship.transform.heading = heading;
      }
      
      console.log(`Ship ${shipId} incremental move in ${currentPhase}: (${x.toFixed(2)}, ${y.toFixed(2)}) heading ${heading.toFixed(2)}`);
      return;
    }

    // 简化验证：直接检查距离和角度
    const moveDistance = distance(startX, startY, x, y);
    const maxMoveDistance = ship.maxSpeed * 4; // 两阶段各最大 2X
    
    if (moveDistance > maxMoveDistance) {
      throw new Error(`Move distance ${moveDistance.toFixed(2)} exceeds maximum ${maxMoveDistance}`);
    }

    // 验证转向角度
    const headingDiff = angleDifference(startHeading, heading);
    if (headingDiff > ship.maxTurnRate) {
      throw new Error(`Turn angle ${headingDiff.toFixed(2)} exceeds maximum ${ship.maxTurnRate}`);
    }

    // 检查地图边界
    if (x < -this.state.mapWidth / 2 || x > this.state.mapWidth / 2 || 
        y < -this.state.mapHeight / 2 || y > this.state.mapHeight / 2) {
      throw new Error("Target position is outside map boundaries");
    }

    // 执行移动
    ship.transform.x = x;
    ship.transform.y = y;
    ship.transform.heading = heading;
    ship.hasMoved = true;

    console.log(`Ship ${shipId} moved to (${x.toFixed(2)}, ${y.toFixed(2)}) heading ${heading.toFixed(2)}`);
  }

    this.validateAuthority(client, ship);

    // 检查是否过载
    if (ship.isOverloaded) {
      throw new Error("Cannot move while overloaded");
    }

    // 检查是否已移动过
    if (ship.hasMoved) {
      throw new Error("Ship has already moved this turn");
    }

    const startX = ship.transform.x;
    const startY = ship.transform.y;
    const startHeading = ship.transform.heading;

    // 如果有详细的移动计划，使用三阶段移动验证
    if (movementPlan) {
      const validation = validateThreePhaseMove(
        startX, startY, startHeading,
        movementPlan,
        ship.maxSpeed,
        ship.maxTurnRate
      );
      
      if (!validation.valid) {
        throw new Error(validation.error || "Invalid movement");
      }
      
      // 记录移动参数
      ship.movePhaseAX = movementPlan.phaseAForward;
      ship.movePhaseAStrafe = movementPlan.phaseAStrafe;
      ship.turnAngle = movementPlan.turnAngle;
      ship.movePhaseBX = movementPlan.phaseBForward;
      ship.movePhaseBStrafe = movementPlan.phaseBStrafe;
    } else {
      // 简化验证：直接检查距离和角度
      // 验证移动距离
      const moveDistance = distance(startX, startY, x, y);
      const maxMoveDistance = ship.maxSpeed * 4; // 两阶段各最大2X
      
      if (moveDistance > maxMoveDistance) {
        throw new Error(`Move distance ${moveDistance.toFixed(2)} exceeds maximum ${maxMoveDistance}`);
      }

      // 验证转向角度
      const headingDiff = angleDifference(startHeading, heading);
      if (headingDiff > ship.maxTurnRate) {
        throw new Error(`Turn angle ${headingDiff.toFixed(2)} exceeds maximum ${ship.maxTurnRate}`);
      }
    }

    // 检查地图边界
    if (x < -this.state.mapWidth / 2 || x > this.state.mapWidth / 2 || 
        y < -this.state.mapHeight / 2 || y > this.state.mapHeight / 2) {
      throw new Error("Target position is outside map boundaries");
    }

    // 执行移动
    ship.transform.x = x;
    ship.transform.y = y;
    ship.transform.heading = heading;
    ship.hasMoved = true;

    console.log(`Ship ${shipId} moved to (${x.toFixed(2)}, ${y.toFixed(2)}) heading ${heading.toFixed(2)}`);
  }

  /**
   * 处理护盾切换指令
   */
  dispatchToggleShield(client: Client, payload: ToggleShieldPayload): void {
    const { shipId, isActive, orientation } = payload;

    const ship = this.state.ships.get(shipId);
    if (!ship) {
      throw new Error(`Ship ${shipId} not found`);
    }

    this.validateAuthority(client, ship);

    // 检查是否过载
    if (ship.isOverloaded && isActive) {
      throw new Error("Cannot raise shield while overloaded");
    }

    // 开启护盾消耗软辐能
    if (isActive && !ship.isShieldUp) {
      const fluxCost = GAME_CONFIG.SHIELD_UP_FLUX_COST;
      if (ship.fluxSoft + ship.fluxHard + fluxCost > ship.fluxMax) {
        throw new Error("Not enough flux capacity to raise shield");
      }
      ship.fluxSoft += fluxCost;
    }

    ship.isShieldUp = isActive;
    if (orientation !== undefined) {
      ship.shieldOrientation = orientation;
    } else if (isActive) {
      // 默认护盾朝向与舰体朝向一致
      ship.shieldOrientation = ship.transform.heading;
    }

    console.log(`Ship ${shipId} shield ${isActive ? "raised" : "lowered"}`);
  }

  /**
   * 处理开火指令
   */
  dispatchFireWeapon(client: Client, payload: FireWeaponPayload): void {
    const { attackerId, weaponId, targetId } = payload;

    const attacker = this.state.ships.get(attackerId);
    const target = this.state.ships.get(targetId);

    if (!attacker) {
      throw new Error(`舰船 ${attackerId} 不存在`);
    }
    
    this.validateAuthority(client, attacker);

    if (!target) {
      throw new Error(`目标舰船 ${targetId} 不存在`);
    }

    if (target.isDestroyed) {
      throw new Error("目标已被摧毁");
    }

    const weapon = attacker.weapons.get(weaponId);
    if (!weapon) {
      throw new Error(`武器 ${weaponId} 不存在`);
    }

    if (attacker.isOverloaded) {
      throw new Error("过载状态无法开火");
    }

    if (weapon.state !== WeaponState.READY) {
      if (weapon.state === WeaponState.COOLDOWN) {
        throw new Error(`武器冷却中：剩余 ${weapon.cooldownRemaining.toFixed(1)} 秒`);
      }
      if (weapon.state === WeaponState.OUT_OF_AMMO) {
        throw new Error("弹药耗尽");
      }
      throw new Error("武器不可用");
    }

    if (weapon.hasFiredThisTurn) {
      throw new Error("该武器本回合已射击");
    }

    const dist = distance(
      attacker.transform.x, 
      attacker.transform.y,
      target.transform.x,
      target.transform.y
    );

    if (dist > weapon.range) {
      throw new Error(`目标超出射程：距离 ${dist.toFixed(0)} > 射程 ${weapon.range}`);
    }

    if (weapon.fluxCost > 0) {
      const totalFlux = attacker.fluxHard + attacker.fluxSoft + weapon.fluxCost;
      if (totalFlux > attacker.fluxMax) {
        throw new Error(`辐能不足：需要 ${weapon.fluxCost}，当前容量 ${attacker.fluxMax - attacker.fluxHard - attacker.fluxSoft}`);
      }
      attacker.fluxSoft += weapon.fluxCost;
    }

    if (weapon.maxAmmo > 0) {
      if (weapon.currentAmmo <= 0) {
        weapon.state = WeaponState.OUT_OF_AMMO;
        throw new Error("弹药耗尽");
      }
      weapon.currentAmmo -= 1;
      if (weapon.currentAmmo <= 0) {
        weapon.state = WeaponState.OUT_OF_AMMO;
      }
    }

    const weaponWorldAngle = attacker.transform.heading + weapon.mountFacing;
    const angleToTarget = angleBetween(
      attacker.transform.x,
      attacker.transform.y,
      target.transform.x,
      target.transform.y
    );

    const normalizedWeaponAngle = ((weaponWorldAngle % 360) + 360) % 360;
    const normalizedTargetAngle = ((angleToTarget % 360) + 360) % 360;
    const angleDiff = angleDifference(normalizedWeaponAngle, normalizedTargetAngle);
    
    const arcCenter = (weapon.arcMin + weapon.arcMax) / 2;
    const arcHalfWidth = (weapon.arcMax - weapon.arcMin) / 2;
    const relativeArcDiff = angleDifference(arcCenter, normalizedTargetAngle);
    
    if (Math.abs(relativeArcDiff) > arcHalfWidth) {
      throw new Error(`目标不在射界内：角度偏差 ${relativeArcDiff.toFixed(0)}°`);
    }

    weapon.cooldownRemaining = weapon.cooldownMax || GAME_CONFIG.DEFAULT_COOLDOWN;
    weapon.state = WeaponState.COOLDOWN;
    weapon.hasFiredThisTurn = true;

    this.applyDamage(attacker, weapon, target);

    console.log(`[Fire] ${attacker.name || attackerId} 使用 ${weapon.name || weaponId} 攻击 ${target.name || targetId}`);
  }

  /**
   * 应用伤害 - 包含完整的6象限装甲机制
   */
  private applyDamage(
    attacker: ShipState, 
    weapon: WeaponSlot, 
    target: ShipState
  ): void {
    const damageType = weapon.damageType;
    const baseDamage = weapon.damage;
    
    const hitAngle = angleBetween(
      target.transform.x,
      target.transform.y,
      attacker.transform.x,
      attacker.transform.y
    );
    const relativeAngle = hitAngle - target.transform.heading;
    const normalizedAngle = ((relativeAngle % 360) + 360) % 360;
    const section = Math.floor(normalizedAngle / 60) % 6;

    let actualDamage = baseDamage;
    let hitShield = false;

    if (target.isShieldUp && !weapon.ignoresShields) {
      const shieldAngleDiff = angleDifference(target.shieldOrientation, hitAngle);
      if (shieldAngleDiff <= target.shieldArc / 2) {
        hitShield = true;
        
        const shieldMultiplier = DAMAGE_MULTIPLIERS[damageType].shield;
        const shieldDamage = baseDamage * shieldMultiplier;
        
        target.fluxHard += shieldDamage * GAME_CONFIG.SHIELD_FLUX_PER_DAMAGE;
        
        if (target.fluxHard + target.fluxSoft >= target.fluxMax) {
          target.isOverloaded = true;
          target.overloadTime = GAME_CONFIG.OVERLOAD_BASE_DURATION;
          target.isShieldUp = false;
          console.log(`[Damage] ${target.name || target.id} 过载！`);
        }

        actualDamage = 0;
        console.log(`[Damage] 护盾吸收 ${shieldDamage.toFixed(0)} → 硬辐能 +${shieldDamage}`);
      }
    }

    if (!hitShield && actualDamage > 0) {
      const armorMultiplier = DAMAGE_MULTIPLIERS[damageType].armor;
      const hullMultiplier = DAMAGE_MULTIPLIERS[damageType].hull;
      
      const currentArmor = target.armorCurrent[section] ?? 0;
      
      const hitStrength = actualDamage * armorMultiplier;
      const effectiveArmor = Math.max(currentArmor * 0.05, currentArmor);
      const damageReduction = hitStrength / (hitStrength + effectiveArmor);
      const armorDamage = Math.min(currentArmor, actualDamage * armorMultiplier);
      
      if (currentArmor > 0) {
        target.armorCurrent[section] = Math.max(0, currentArmor - armorDamage);
        
        const hullDamage = actualDamage * hullMultiplier * (1 - damageReduction);
        target.hullCurrent -= hullDamage;
        
        console.log(`[Damage] 象限${section}: 装甲-${armorDamage.toFixed(0)}, 船体-${hullDamage.toFixed(0)}`);
      } else {
        target.hullCurrent -= actualDamage * hullMultiplier;
        console.log(`[Damage] 直接船体伤害: ${actualDamage * hullMultiplier}`);
      }

      if (target.hullCurrent <= 0) {
        target.hullCurrent = 0;
        target.isDestroyed = true;
        target.isShieldUp = false;
        console.log(`[Damage] ${target.name || target.id} 被摧毁！`);
      }
    }
  }

  /**
   * 处理排散指令
   */
  dispatchVentFlux(client: Client, payload: VentFluxPayload): void {
    const { shipId } = payload;

    const ship = this.state.ships.get(shipId);
    if (!ship) {
      throw new Error(`Ship ${shipId} not found`);
    }

    this.validateAuthority(client, ship);

    // 检查是否过载
    if (ship.isOverloaded) {
      throw new Error("Cannot vent flux while overloaded");
    }

    // 检查护盾是否关闭
    if (ship.isShieldUp) {
      throw new Error("Must lower shield to vent flux");
    }

    // 排散辐能
    const ventAmount = GAME_CONFIG.VENT_FLUX_RATE;
    ship.fluxHard = Math.max(0, ship.fluxHard - ventAmount);
    ship.fluxSoft = Math.max(0, ship.fluxSoft - ventAmount);

    // 排散期间锁定行动
    ship.hasMoved = true;
    ship.hasFired = true;

    console.log(`Ship ${shipId} vented flux: -${ventAmount}`);
  }

  /**
   * 强制清除过载 (DM指令)
   */
   dispatchClearOverload(client: Client, shipId: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.role !== PlayerRole.DM) {
      throw new Error("只有 DM 可以执行此指令");
    }

    const ship = this.state.ships.get(shipId);
    if (!ship) {
      throw new Error(`Ship ${shipId} not found`);
    }

    ship.isOverloaded = false;
    ship.overloadTime = 0;
    ship.fluxHard = Math.max(0, ship.fluxHard - GAME_CONFIG.OVERLOAD_FLUX_DECAY);
    
    console.log(`Ship ${shipId} overload cleared by DM`);
  }

  /**
   * 强制修改护甲值 (DM指令)
   */
   dispatchSetArmor(client: Client, shipId: string, section: number, value: number): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.role !== PlayerRole.DM) {
      throw new Error("只有 DM 可以执行此指令");
    }

    const ship = this.state.ships.get(shipId);
    if (!ship) {
      throw new Error(`Ship ${shipId} not found`);
    }

    if (section < 0 || section >= 6) {
      throw new Error(`Invalid armor section: ${section}`);
    }

    const maxArmor = ship.armorMax[section] || 0;
    ship.armorCurrent[section] = Math.max(0, Math.min(maxArmor, value));
    
    console.log(`Ship ${shipId} armor section ${section} set to ${value} by DM`);
  }

  /**
   * 分配舰船控制权 (DM指令)
   */
   dispatchAssignShip(client: Client, shipId: string, targetSessionId: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.role !== PlayerRole.DM) {
      throw new Error("只有 DM 可以执行此指令");
    }

    const ship = this.state.ships.get(shipId);
    if (!ship) {
      throw new Error(`Ship ${shipId} not found`);
    }

    if (targetSessionId && !this.state.players.has(targetSessionId)) {
      throw new Error("目标玩家不存在");
    }

    ship.ownerId = targetSessionId;
    console.log(`Ship ${shipId} assigned to ${targetSessionId || 'DM'}`);
  }
}
