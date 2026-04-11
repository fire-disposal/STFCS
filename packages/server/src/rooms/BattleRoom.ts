/**
 * 战斗房间 - Colyseus 多人游戏房间
 * 
 * 遵循 Colyseus 最佳实践：
 * - 使用泛型声明状态类型
 * - 实现 onAuth 进行认证
 * - 正确处理 onLeave 和重连
 * - 使用 setMetadata 更新房间元数据
 */

import { Room, Client } from "@colyseus/core";
import { GameRoomState, ShipState, PlayerState } from "@vt/shared";
import { ClientCommand, getShipHullSpec, getWeaponSpec } from "@vt/shared";
import { CommandDispatcher } from "../commands/CommandDispatcher";

// ==================== 消息 Payload 类型定义 ====================

interface NetPingPayload {
  seq: number;
  clientSentAt: number;
}

interface MoveTokenPayload {
  shipId: string;
  x: number;
  y: number;
  heading: number;
  movementPlan?: {
    phaseAForward: number;
    phaseAStrafe: number;
    turnAngle: number;
    phaseBForward: number;
    phaseBStrafe: number;
  };
}

interface ToggleShieldPayload {
  shipId: string;
  isActive: boolean;
  orientation?: number;
}

interface FireWeaponPayload {
  attackerId: string;
  weaponId: string;
  targetId: string;
}

interface VentFluxPayload {
  shipId: string;
}

interface DMClearOverloadPayload {
  shipId: string;
}

interface DMSetArmorPayload {
  shipId: string;
  section: number;
  value: number;
}

interface CreateObjectPayload {
  type: 'ship' | 'station' | 'asteroid';
  hullId?: string;
  x: number;
  y: number;
  heading: number;
  faction: 'player' | 'dm';
  ownerId?: string;
}

// ==================== 战斗房间类 ====================

export class BattleRoom extends Room<GameRoomState> {
  maxClients = 8;
  private commandDispatcher!: CommandDispatcher;
  private readonly pingEwma = new Map<string, number>();
  private readonly jitterEwma = new Map<string, number>();

  /**
   * 房间创建初始化
   * Colyseus 在第一个客户端加入时自动调用
   */
  onCreate(options: { playerName?: string }) {
    console.log(`[BattleRoom] Room created - ID: ${this.roomId}, PlayerName: ${options.playerName || 'default'}`);

    // 初始化状态
    this.state = new GameRoomState();

    // 初始化命令分发器
    this.commandDispatcher = new CommandDispatcher(this.state);

    // 设置初始游戏阶段
    this.state.currentPhase = "DEPLOYMENT";
    this.state.turnCount = 1;

    // 注册所有消息处理器
    this.registerMessageHandlers();

    // 设置游戏循环 (60 FPS)
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 16);

    // 设置房间元数据（用于大厅显示）
    this.setMetadata({
      name: `Battle - ${this.roomId.substring(0, 6)}`,
      phase: this.state.currentPhase,
      turnCount: 1,
      playerCount: 0,
      maxPlayers: this.maxClients,
    });

    console.log(`[BattleRoom] Initialization complete, metadata set`);
    console.log(`[BattleRoom] Room state type: ${this.state.constructor.name}`);
  }

  /**
   * 客户端认证 - 简化版，仅验证玩家名称
   * 在 onJoin 之前调用
   */
  async onAuth(client: Client, options: { playerName?: string }) {
    const playerName = options?.playerName?.trim() || `Player_${client.sessionId.substring(0, 4)}`;
    
    // 保存到 client 对象供 onJoin 使用
    (client as any).playerName = playerName;
    
    console.log(`[BattleRoom] Auth: ${playerName} (${client.sessionId})`);
    return true; // 总是允许加入
  }

  /**
   * 客户端加入房间
   * 在 onAuth 成功后调用
   */
  onJoin(client: Client) {
    // 从 onAuth 传递的名称
    const playerName = (client as Client & { playerName: string }).playerName || `Player_${client.sessionId.substring(0, 4)}`;
    console.log(`[BattleRoom] Player joined: ${playerName} (${client.sessionId})`);

    // 创建玩家状态
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.name = playerName;
    player.role = "player";
    player.connected = true;
    player.isReady = false;
    player.pingMs = -1;
    player.jitterMs = 0;
    player.connectionQuality = "excellent";

    // 第一个玩家自动成为 DM
    if (this.clients.length === 1) {
      player.role = "dm";
      console.log(`[BattleRoom] First player is DM`);
    }

    // 发送角色信息
    client.send("role", { role: player.role });

    // 添加到状态
    this.state.players.set(client.sessionId, player);
    this.pingEwma.set(client.sessionId, -1);
    this.jitterEwma.set(client.sessionId, 0);

    // 更新元数据
    this.updateMetadata();

    console.log(`[BattleRoom] Total players: ${this.clients.length}/${this.maxClients}`);
  }

  /**
   * 客户端离开房间
   * Colyseus v0.17 使用 code 和 data 参数
   */
  async onLeave(client: Client, code?: number, data?: unknown) {
    const sessionId = client.sessionId;
    console.log(`[BattleRoom] Player leaving: ${sessionId}, code: ${code}`);

    const player = this.state.players.get(sessionId);
    if (player) {
      player.connected = false;
      player.connectionQuality = "offline";
    }

    // 判断是否允许重连 (code 1000 表示正常关闭)
    const allowReconnect = code !== 1000;

    if (allowReconnect) {
      try {
        // 允许 1 小时内重连
        await this.allowReconnection(client, 3600);
        console.log(`[BattleRoom] Player reconnected: ${sessionId}`);

        if (player) {
          player.connected = true;
          if (player.pingMs >= 0) {
            player.connectionQuality = this.toQuality(player.pingMs);
          }
        }

        this.updateMetadata();
        return;
      } catch (e) {
        console.log(`[BattleRoom] Reconnection timeout for ${sessionId}`);
      }
    }

    // 彻底离开 - 清理玩家数据
    console.log(`[BattleRoom] Player permanently removed: ${sessionId}`);
    this.state.players.delete(sessionId);
    this.pingEwma.delete(sessionId);
    this.jitterEwma.delete(sessionId);

    // 清除该玩家对舰船的所有权
    this.state.ships.forEach((ship) => {
      if (ship.ownerId === sessionId) {
        ship.ownerId = '';
      }
    });

    // 检查是否需要销毁房间
    if (this.state.players.size === 0) {
      console.log('[BattleRoom] No players left, room will be destroyed');
    }

    this.updateMetadata();
  }

  /**
   * 房间销毁时的清理
   */
  onDispose() {
    console.log(`[BattleRoom] Room ${this.roomId} is being disposed`);
    this.pingEwma.clear();
    this.jitterEwma.clear();
  }

  /**
   * 更新房间元数据（用于大厅显示）
   */
  private updateMetadata() {
    let dmCount = 0;
    let playerCount = 0;
    
    this.state.players.forEach((p) => {
      if (p.connected) {
        if (p.role === 'dm') dmCount++;
        else playerCount++;
      }
    });

    this.setMetadata({
      name: this.roomId,
      phase: this.state.currentPhase,
      turnCount: this.state.turnCount,
      playerCount: this.clients.length,
      dmCount,
      maxPlayers: this.maxClients,
    });
  }

  /**
   * 注册所有消息处理器
   */
  private registerMessageHandlers() {
    // 移动指令
    this.onMessage(ClientCommand.CMD_MOVE_TOKEN, (client, payload: MoveTokenPayload) => {
      try {
        this.commandDispatcher.dispatchMoveToken(client, payload);
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // 护盾指令
    this.onMessage(ClientCommand.CMD_TOGGLE_SHIELD, (client, payload: ToggleShieldPayload) => {
      try {
        this.commandDispatcher.dispatchToggleShield(client, payload);
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // 开火指令
    this.onMessage(ClientCommand.CMD_FIRE_WEAPON, (client, payload: FireWeaponPayload) => {
      try {
        this.commandDispatcher.dispatchFireWeapon(client, payload);
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // 排散指令
    this.onMessage(ClientCommand.CMD_VENT_FLUX, (client, payload: VentFluxPayload) => {
      try {
        this.commandDispatcher.dispatchVentFlux(client, payload);
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // 分配舰船指令
    this.onMessage(ClientCommand.CMD_ASSIGN_SHIP, (client, payload: { shipId: string; targetSessionId: string }) => {
      try {
        this.commandDispatcher.dispatchAssignShip(client, payload.shipId, payload.targetSessionId);
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // 切换准备状态
    this.onMessage(ClientCommand.CMD_TOGGLE_READY, (client, payload: { isReady: boolean }) => {
      try {
        const player = this.state.players.get(client.sessionId);
        if (player) {
          player.isReady = payload.isReady;
          this.checkAutoAdvancePhase();
        }
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // 下一阶段指令
    this.onMessage(ClientCommand.CMD_NEXT_PHASE, (client) => {
      try {
        const player = this.state.players.get(client.sessionId);
        if (player?.role === 'dm') {
          this.advancePhase();
        } else {
          throw new Error("只有 DM 可以强制进入下一阶段");
        }
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // 创建测试舰船（旧接口，保留兼容性）
    this.onMessage("CREATE_TEST_SHIP", (client, payload: { faction: "player" | "dm"; x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player?.role === 'dm') {
        this.createTestShip(payload.faction, payload.x, payload.y);
      } else {
        client.send("error", { message: "只有 DM 可以创建测试舰船" });
      }
    });

    // DM 创建对象（新接口）
    this.onMessage("DM_CREATE_OBJECT", (client, payload: CreateObjectPayload) => {
      const player = this.state.players.get(client.sessionId);
      if (player?.role === 'dm') {
        this.createObject(payload);
      } else {
        client.send("error", { message: "只有 DM 可以创建对象" });
      }
    });

    // DM 清除过载
    this.onMessage("DM_CLEAR_OVERLOAD", (client, payload: DMClearOverloadPayload) => {
      try {
        this.commandDispatcher.dispatchClearOverload(client, payload.shipId);
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // DM 修改护甲
    this.onMessage("DM_SET_ARMOR", (client, payload: DMSetArmorPayload) => {
      try {
        this.commandDispatcher.dispatchSetArmor(client, payload.shipId, payload.section, payload.value);
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // 网络质量探测
    this.onMessage("NET_PING", (client, payload: NetPingPayload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.connected) return;

      const now = Date.now();
      const sampleRtt = Math.max(0, now - payload.clientSentAt);
      const prevRtt = this.pingEwma.get(client.sessionId) ?? -1;
      const alpha = 0.2;
      const nextRtt = prevRtt < 0 ? sampleRtt : prevRtt * (1 - alpha) + sampleRtt * alpha;

      const prevJitter = this.jitterEwma.get(client.sessionId) ?? 0;
      const jitterSample = prevRtt < 0 ? 0 : Math.abs(sampleRtt - prevRtt);
      const nextJitter = prevJitter * 0.7 + jitterSample * 0.3;

      this.pingEwma.set(client.sessionId, nextRtt);
      this.jitterEwma.set(client.sessionId, nextJitter);

      player.pingMs = Math.round(nextRtt);
      player.jitterMs = Math.round(nextJitter);
      player.connectionQuality = this.toQuality(player.pingMs);

      client.send("NET_PONG", {
        seq: payload.seq,
        serverTime: now,
        pingMs: player.pingMs,
        jitterMs: player.jitterMs,
        quality: player.connectionQuality,
      });
    });
  }

  /**
   * 游戏主循环
   */
  private update(deltaTime: number) {
    // 更新所有舰船的状态
    this.state.ships.forEach((ship) => {
      // 更新武器冷却
      ship.weapons.forEach((weapon) => {
        if (weapon.cooldown > 0) {
          weapon.cooldown = Math.max(0, weapon.cooldown - deltaTime / 1000);
        }
      });

      // 更新过载时间
      if (ship.isOverloaded && ship.overloadTime > 0) {
        ship.overloadTime -= deltaTime / 1000;
        if (ship.overloadTime <= 0) {
          ship.isOverloaded = false;
          ship.overloadTime = 0;
        }
      }
    });
  }

  /**
   * 检查是否自动进入下一阶段
   */
  private checkAutoAdvancePhase() {
    if (this.state.currentPhase !== "PLAYER_TURN") return;

    let allReady = true;
    let hasPlayers = false;

    this.state.players.forEach((player) => {
      if (player.role === "player" && player.connected) {
        hasPlayers = true;
        if (!player.isReady) {
          allReady = false;
        }
      }
    });

    if (hasPlayers && allReady) {
      console.log("[BattleRoom] All players ready, advancing phase");
      this.advancePhase();
    }
  }

  /**
   * 推进游戏阶段
   */
  private advancePhase() {
    const phases: GamePhase[] = ["DEPLOYMENT", "PLAYER_TURN", "DM_TURN", "END_PHASE"];
    const currentIndex = phases.indexOf(this.state.currentPhase);
    let nextIndex = currentIndex + 1;

    if (nextIndex >= phases.length) {
      nextIndex = phases.indexOf("PLAYER_TURN");
    }

    const oldPhase = this.state.currentPhase;
    this.state.currentPhase = phases[nextIndex];

    // 重置所有玩家的 ready 状态
    this.state.players.forEach((p) => (p.isReady = false));

    // 处理阶段转换
    if (this.state.currentPhase === "END_PHASE") {
      this.handleEndPhase();
      return this.advancePhase();
    }

    // 设置活跃阵营
    this.state.activeFaction = this.state.currentPhase === "PLAYER_TURN" ? "player" : "dm";

    // 广播阶段变更
    this.broadcast("phase_change", { 
      phase: this.state.currentPhase,
      oldPhase,
      turnCount: this.state.turnCount,
    });

    this.updateMetadata();
    console.log(`[BattleRoom] Phase changed: ${oldPhase} -> ${this.state.currentPhase}`);
  }

  /**
   * 处理结束阶段
   */
  private handleEndPhase() {
    this.state.ships.forEach((ship) => {
      // 清空软辐能
      ship.fluxSoft = 0;

      // 重置行动标记
      ship.hasMoved = false;
      ship.hasFired = false;

      // 护盾维持消耗
      if (ship.isShieldUp) {
        ship.fluxSoft += 2;
      }

      // 检查过载
      if (ship.fluxSoft + ship.fluxHard >= ship.fluxMax) {
        ship.isOverloaded = true;
        ship.overloadTime = 10;
        ship.isShieldUp = false;
      }
    });

    this.state.turnCount++;
  }

  /**
   * 创建测试舰船
   */
  private createTestShip(faction: "player" | "dm", x: number, y: number) {
    const ship = new ShipState();
    ship.id = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    ship.faction = faction;
    ship.hullType = "frigate";
    ship.transform.x = x;
    ship.transform.y = y;
    ship.transform.heading = faction === "player" ? 0 : 180;

    ship.hullMax = 1000;
    ship.hullCurrent = 1000;
    ship.armorMax = [150, 150, 150, 100, 150, 150];
    ship.armorCurrent = [150, 150, 150, 100, 150, 150];
    ship.fluxMax = 200;
    ship.fluxHard = 0;
    ship.fluxSoft = 0;
    ship.maxSpeed = 100;
    ship.maxTurnRate = 45;
    ship.acceleration = 50;

    const weapon = {
      weaponId: `weapon_${Date.now()}`,
      type: "kinetic" as const,
      damage: 50,
      range: 300,
      arc: 90,
      angle: 0,
      cooldown: 0,
    };
    ship.weapons.set(weapon.weaponId, weapon);

    this.state.ships.set(ship.id, ship);
    console.log(`[BattleRoom] Created test ship: ${ship.id} at (${x}, ${y})`);
  }

  /**
   * DM 创建对象（舰船/空间站/小行星）
   */
  createObject(payload: CreateObjectPayload) {
    const { type, hullId, x, y, heading, faction, ownerId } = payload;

    if (type === 'ship' && hullId) {
      const shipSpec = getShipHullSpec(hullId);
      if (!shipSpec) {
        console.error(`[BattleRoom] Ship hull not found: ${hullId}`);
        return;
      }

      const ship = new ShipState();
      ship.id = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      ship.faction = faction;
      ship.hullType = hullId;
      ship.ownerId = ownerId || '';
      ship.transform.x = x;
      ship.transform.y = y;
      ship.transform.heading = heading;

      ship.hullMax = shipSpec.hullPoints;
      ship.hullCurrent = shipSpec.hullPoints;

      const armorDist = shipSpec.armorDistribution || Array(6).fill(shipSpec.armorValue);
      ship.armorMax = armorDist;
      ship.armorCurrent = [...armorDist];

      ship.fluxMax = shipSpec.fluxCapacity;
      ship.fluxDissipation = shipSpec.fluxDissipation || 10;
      ship.fluxHard = 0;
      ship.fluxSoft = 0;

      ship.maxSpeed = shipSpec.maxSpeed;
      ship.maxTurnRate = shipSpec.maxTurnRate;
      ship.acceleration = shipSpec.acceleration;

      if (shipSpec.hasShield) {
        ship.isShieldUp = false;
        ship.shieldOrientation = heading;
        ship.shieldArc = shipSpec.shieldArc || 120;
      }

      // 添加武器
      for (const mount of shipSpec.weaponMounts) {
        const weaponSpec = mount.defaultWeapon ? getWeaponSpec(mount.defaultWeapon) : null;
        if (weaponSpec) {
          ship.weapons.set(mount.id, {
            weaponId: mount.id,
            type: this.mapDamageType(weaponSpec.damageType),
            damage: weaponSpec.damage,
            range: weaponSpec.range,
            arc: weaponSpec.arc,
            angle: mount.facing,
            cooldown: 0,
          });
        }
      }

      this.state.ships.set(ship.id, ship);
      console.log(`[BattleRoom] Created ${hullId} for ${faction} at (${x}, ${y})`);
    } else if (type === 'station' || type === 'asteroid') {
      const ship = new ShipState();
      ship.id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      ship.faction = faction;
      ship.hullType = type;
      ship.ownerId = ownerId || '';
      ship.transform.x = x;
      ship.transform.y = y;
      ship.transform.heading = heading;

      ship.hullMax = type === 'station' ? 5000 : 2000;
      ship.hullCurrent = ship.hullMax;
      ship.armorMax = [300, 300, 300, 200, 300, 300];
      ship.armorCurrent = [300, 300, 300, 200, 300, 300];
      ship.fluxMax = 0;
      ship.fluxHard = 0;
      ship.fluxSoft = 0;
      ship.maxSpeed = 0;
      ship.maxTurnRate = 0;
      ship.acceleration = 0;

      this.state.ships.set(ship.id, ship);
      console.log(`[BattleRoom] Created ${type} at (${x}, ${y})`);
    }
  }

  /**
   * 映射伤害类型
   */
  private mapDamageType(type: string): "kinetic" | "high_explosive" | "energy" | "fragmentation" {
    switch (type) {
      case 'kinetic': return 'kinetic';
      case 'high_explosive': return 'high_explosive';
      case 'energy': return 'energy';
      default: return 'fragmentation';
    }
  }

  /**
   * 将 Ping 值转换为连接质量
   */
  private toQuality(pingMs: number): "excellent" | "good" | "fair" | "poor" | "offline" {
    if (pingMs < 0) return "offline";
    if (pingMs <= 80) return "excellent";
    if (pingMs <= 140) return "good";
    if (pingMs <= 220) return "fair";
    return "poor";
  }
}
