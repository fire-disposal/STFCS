import { ClientCommand, GAME_CONFIG, GameRoomState, ShipState, type WeaponDamageType, DAMAGE_MULTIPLIERS } from "../schema/GameSchema.js";
import { Client } from "@colyseus/core";
import { 
  distance, 
  angleBetween, 
  angleDifference,
  validateThreePhaseMove,
} from "@vt/rules";
import type { MoveTokenPayload, ToggleShieldPayload, FireWeaponPayload, VentFluxPayload } from "../rooms/BattleRoom.js";

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
    if (player.role === "dm") {
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
   * 处理移动指令 - 支持三阶段移动
   */
  dispatchMoveToken(client: Client, payload: MoveTokenPayload): void {
    const { shipId, x, y, heading, movementPlan } = payload;

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
      throw new Error(`Attacker ${attackerId} not found`);
    }
    
    this.validateAuthority(client, attacker);

    if (!target) {
      throw new Error(`Target ${targetId} not found`);
    }

    const weapon = attacker.weapons.get(weaponId);
    if (!weapon) {
      throw new Error(`Weapon ${weaponId} not found`);
    }

    // 检查是否过载
    if (attacker.isOverloaded) {
      throw new Error("Cannot fire while overloaded");
    }

    // 检查冷却
    if (weapon.cooldown > 0) {
      throw new Error(`Weapon is on cooldown: ${weapon.cooldown.toFixed(2)}s remaining`);
    }

    // 检查是否已开火
    if (attacker.hasFired) {
      throw new Error("Ship has already fired this turn");
    }

    // 计算距离和角度
    const dist = distance(
      attacker.transform.x, 
      attacker.transform.y,
      target.transform.x,
      target.transform.y
    );

    // 检查射程
    if (dist > weapon.range) {
      throw new Error(`Target out of range: ${dist.toFixed(2)} > ${weapon.range}`);
    }

    // 计算武器绝对角度
    const weaponAbsoluteAngle = attacker.transform.heading + weapon.angle;
    
    // 计算目标相对角度
    const angleToTarget = angleBetween(
      attacker.transform.x,
      attacker.transform.y,
      target.transform.x,
      target.transform.y
    );

    // 检查射界
    const angleDiff = angleDifference(weaponAbsoluteAngle, angleToTarget);
    if (angleDiff > weapon.arc / 2) {
      throw new Error(`Target outside weapon arc: ${angleDiff.toFixed(2)} > ${weapon.arc / 2}`);
    }

    // 设置冷却
    weapon.cooldown = 5; // 简化：固定5秒冷却
    attacker.hasFired = true;

    // 计算伤害
    this.applyDamage(attacker, weapon, target);

    console.log(`Ship ${attackerId} fired weapon ${weaponId} at ${targetId}`);
  }

  /**
   * 应用伤害 - 包含完整的6象限装甲机制
   */
  private applyDamage(
    attacker: ShipState, 
    weapon: { type: WeaponDamageType; damage: number }, 
    target: ShipState
  ): void {
    const damageType = weapon.type;
    const baseDamage = weapon.damage;
    
    // 计算命中象限 (0-5)
    // 象限0: 前 (0-60°), 1: 前右 (60-120°), 2: 后右 (120-180°)
    // 3: 后 (180-240°), 4: 后左 (240-300°), 5: 前左 (300-360°)
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

    // 检查是否命中护盾
    if (target.isShieldUp) {
      const shieldAngleDiff = angleDifference(target.shieldOrientation, hitAngle);
      if (shieldAngleDiff <= target.shieldArc / 2) {
        hitShield = true;
        
        // 护盾伤害计算
        const shieldMultiplier = DAMAGE_MULTIPLIERS[damageType].shield;
        const shieldDamage = baseDamage * shieldMultiplier;
        
        // 护盾将伤害转化为硬辐能
        target.fluxHard += shieldDamage;
        
        // 检查是否过载
        if (target.fluxHard + target.fluxSoft >= target.fluxMax) {
          target.isOverloaded = true;
          target.overloadTime = GAME_CONFIG.OVERLOAD_BASE_DURATION;
          target.isShieldUp = false; // 护盾崩溃
          console.log(`Ship ${target.id} overloaded!`);
        }

        actualDamage = 0; // 护盾完全吸收
        console.log(`Hit shield: ${shieldDamage.toFixed(2)} hard flux added`);
      }
    }

    // 如果未命中护盾或护盾已崩溃，伤害装甲/船体
    if (!hitShield && actualDamage > 0) {
      const armorMultiplier = DAMAGE_MULTIPLIERS[damageType].armor;
      const hullMultiplier = DAMAGE_MULTIPLIERS[damageType].hull;
      
      const currentArmor = target.armorCurrent[section] ?? 0;
      const maxArmor = target.armorMax[section] || 1;
      
      // 计算有效护甲值 (根据远行星号公式)
      // 基础伤害减免公式: damage = base * (hitStrength / (hitStrength + armor))
      const hitStrength = actualDamage * armorMultiplier;
      const effectiveArmor = Math.max(currentArmor * 0.05, currentArmor); // 最小5%护甲值
      const damageReduction = hitStrength / (hitStrength + effectiveArmor);
      const armorDamage = Math.min(currentArmor, actualDamage * armorMultiplier);
      
      if ((currentArmor ?? 0) > 0) {
        // 伤害装甲
        target.armorCurrent[section] = Math.max(0, (currentArmor ?? 0) - armorDamage);
        
        // 剩余伤害传递到船体 (根据伤害减免)
        const hullDamage = actualDamage * hullMultiplier * (1 - damageReduction);
        target.hullCurrent -= hullDamage;
        
        console.log(`Hit armor section ${section}: ${armorDamage.toFixed(2)} armor, ${hullDamage.toFixed(2)} hull`);
      } else {
        // 直接伤害船体
        target.hullCurrent -= actualDamage * hullMultiplier;
        console.log(`Direct hull hit: ${(actualDamage * hullMultiplier).toFixed(2)}`);
      }

      // 检查舰船是否被摧毁
      if (target.hullCurrent <= 0) {
        target.hullCurrent = 0;
        console.log(`Ship ${target.id} destroyed!`);
        // TODO: 处理舰船被摧毁
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
    if (!player || player.role !== "dm") {
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
    if (!player || player.role !== "dm") {
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
    if (!player || player.role !== "dm") {
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
