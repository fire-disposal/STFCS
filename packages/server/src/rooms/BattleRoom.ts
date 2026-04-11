import { Room, Client } from "@colyseus/core";
import { GameRoomState, ShipState, GamePhase, WeaponSlot, ArraySchema, PlayerState } from "@vt/shared";
import { ClientCommand, MovementPlan } from "@vt/shared";
import { CommandDispatcher } from "../commands/CommandDispatcher";

interface NetPingPayload {
  seq: number;
  clientSentAt: number;
}

export interface MoveTokenPayload {
  shipId: string;
  x: number;
  y: number;
  heading: number;
  movementPlan?: MovementPlan;
}

export interface ToggleShieldPayload {
  shipId: string;
  isActive: boolean;
  orientation?: number;
}

export interface FireWeaponPayload {
  attackerId: string;
  weaponId: string;
  targetId: string;
}

export interface VentFluxPayload {
  shipId: string;
}

export interface DMClearOverloadPayload {
  shipId: string;
}

export interface DMSetArmorPayload {
  shipId: string;
  section: number;
  value: number;
}

export class BattleRoom extends Room {
  declare state: GameRoomState;
  maxClients = 8;
  private commandDispatcher!: CommandDispatcher;
  private readonly pingEwma = new Map<string, number>();
  private readonly jitterEwma = new Map<string, number>();

  onCreate(options: Record<string, unknown>) {
    console.log("BattleRoom created!", options);
    
    // 初始化房间状态
    this.setState(new GameRoomState());
    
    // 初始化命令分发器
    this.commandDispatcher = new CommandDispatcher(this.state);

    // 设置阶段
    this.state.currentPhase = "DEPLOYMENT";

    // 注册消息处理器
    this.registerMessageHandlers();

    // 设置游戏循环
    this.setSimulationInterval((deltaTime) => this.update(deltaTime));
  }

  onJoin(client: Client, options: { name?: string }) {
    console.log(`Client ${client.sessionId} joined!`);
    
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.name = options.name || `Player_${client.sessionId.substring(0, 4)}`;

    // 如果是第一个玩家，设为DM
    if (this.clients.length === 1) {
      player.role = "dm";
      client.send("role", { role: "dm" });
    } else {
      player.role = "player";
      client.send("role", { role: "player" });
    }

    this.state.players.set(client.sessionId, player);
    this.pingEwma.set(client.sessionId, -1);
    this.jitterEwma.set(client.sessionId, 0);
  }

  async onLeave(client: Client, code?: number) {
    console.log(`Client ${client.sessionId} left!`);
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = false;
      player.connectionQuality = "offline";
    }

    try {
      // 1000 为正常主动断开，其他情况允许重连
      if (code === 1000) {
        throw new Error("consented leave");
      }

      // 允许断线重连，超时时间 3600 秒
      await this.allowReconnection(client, 3600);
      
      // 玩家重连成功
      console.log(`Client ${client.sessionId} reconnected!`);
      if (player) {
        player.connected = true;
        if (player.pingMs >= 0) {
          player.connectionQuality = this.toQuality(player.pingMs);
        }
      }
    } catch (e) {
      // 玩家彻底离开或超时
      console.log(`Client ${client.sessionId} permanently removed!`);
      this.state.players.delete(client.sessionId);
      this.pingEwma.delete(client.sessionId);
      this.jitterEwma.delete(client.sessionId);
    }
    console.log("BattleRoom disposed!");
  }

  private toQuality(pingMs: number): "excellent" | "good" | "fair" | "poor" | "offline" {
    if (pingMs < 0) return "offline";
    if (pingMs <= 80) return "excellent";
    if (pingMs <= 140) return "good";
    if (pingMs <= 220) return "fair";
    return "poor";
  }

  /**
   * 注册所有客户端消息处理器
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

    // 切换准备状态指令
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
        if (player && player.role === 'dm') {
          this.advancePhase();
        } else {
          throw new Error("只有 DM 可以强制进入下一阶段");
        }
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // 创建测试舰船（临时）
    this.onMessage("CREATE_TEST_SHIP", (client, payload: { faction: "player" | "dm"; x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.role === 'dm') {
        this.createTestShip(payload.faction, payload.x, payload.y);
      } else {
        client.send("error", { message: "只有 DM 可以创建测试舰船" });
      }
    });

    // DM指令：清除过载
    this.onMessage("DM_CLEAR_OVERLOAD", (client, payload: DMClearOverloadPayload) => {
      try {
        this.commandDispatcher.dispatchClearOverload(client, payload.shipId);
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // DM指令：修改护甲
    this.onMessage("DM_SET_ARMOR", (client, payload: DMSetArmorPayload) => {
      try {
        this.commandDispatcher.dispatchSetArmor(client, payload.shipId, payload.section, payload.value);
      } catch (error) {
        client.send("error", { message: (error as Error).message });
      }
    });

    // 连接质量采样：客户端主动上报 ping 探针
    this.onMessage("NET_PING", (client, payload: NetPingPayload) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.connected) {
        return;
      }

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
   * 游戏主循环更新
   */
  private update(deltaTime: number) {
    // 更新所有舰船的冷却、过载时间等
    this.state.ships.forEach((ship: ShipState) => {
      // 更新武器冷却
      ship.weapons.forEach((weapon: WeaponSlot) => {
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
   * 检查是否需要自动进入下一阶段
   */
  private checkAutoAdvancePhase() {
    if (this.state.currentPhase !== "PLAYER_TURN") return;

    let allReady = true;
    let hasPlayers = false;

    this.state.players.forEach((player: PlayerState) => {
      // 只有在线的非DM玩家才需要准备
      if (player.role === "player" && player.connected) {
        hasPlayers = true;
        if (!player.isReady) {
          allReady = false;
        }
      }
    });

    if (hasPlayers && allReady) {
      console.log("All players are ready, advancing to next phase.");
      this.advancePhase();
    }
  }

  /**
   * 推进游戏阶段
   */
  private advancePhase(): void {
    const phases: GamePhase[] = ["DEPLOYMENT", "PLAYER_TURN", "DM_TURN", "END_PHASE"];
    const currentIndex = phases.indexOf(this.state.currentPhase);
    let nextIndex = currentIndex + 1;

    // 如果当前已经是 END_PHASE 或者超越了，进入 PLAYER_TURN 循环
    if (nextIndex >= phases.length) {
      nextIndex = phases.indexOf("PLAYER_TURN");
    }

    this.state.currentPhase = phases[nextIndex];

    // 重置所有玩家的 ready 状态
    this.state.players.forEach((p: PlayerState) => p.isReady = false);

    // 进入END_PHASE时的处理
    if (this.state.currentPhase === "END_PHASE") {
      this.handleEndPhase();
      console.log("End Phase processed, advancing to PLAYER_TURN");
      return this.advancePhase();
    }

    // 切换活跃派系
    if (this.state.currentPhase === "PLAYER_TURN") {
      this.state.activeFaction = "player";
    } else if (this.state.currentPhase === "DM_TURN") {
      this.state.activeFaction = "dm";
    }

    // 广播阶段变更
    this.broadcast("phase_change", { phase: this.state.currentPhase });
  }

  /**
   * 处理结束阶段逻辑
   */
  private handleEndPhase() {
    this.state.ships.forEach((ship: ShipState) => {
      // 清空软辐能
      ship.fluxSoft = 0;
      
      // 重置回合行动标记
      ship.hasMoved = false;
      ship.hasFired = false;
      
      // 护盾维持消耗软辐能
      if (ship.isShieldUp) {
        ship.fluxSoft += 2; // SHIELD_MAINTAIN_FLUX
      }
      
      // 检查是否因护盾维持而过载
      if (ship.fluxSoft + ship.fluxHard >= ship.fluxMax) {
        ship.isOverloaded = true;
        ship.overloadTime = 10; // 基础过载时间
        ship.isShieldUp = false;
      }
    });

    // 增加回合数
    this.state.turnCount++;
  }

  /**
   * 创建测试舰船（开发用）
   */
  private createTestShip(faction: "player" | "dm", x: number, y: number) {
    const ship = new ShipState();
    ship.id = `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    ship.faction = faction;
    ship.hullType = "frigate";
    
    // 设置位置
    ship.transform.x = x;
    ship.transform.y = y;
    ship.transform.heading = faction === "player" ? 0 : 180;
    
    // 设置基础属性
    ship.hullMax = 1000;
    ship.hullCurrent = 1000;
    ship.armorMax = new ArraySchema<number>(150, 150, 150, 100, 150, 150);
    ship.armorCurrent = new ArraySchema<number>(150, 150, 150, 100, 150, 150);
    
    ship.fluxMax = 200;
    ship.fluxHard = 0;
    ship.fluxSoft = 0;
    
    ship.maxSpeed = 100;
    ship.maxTurnRate = 45;
    ship.acceleration = 50;
    
    // 添加测试武器
    const weapon = new WeaponSlot();
    weapon.weaponId = `weapon_${Date.now()}`;
    weapon.type = "kinetic";
    weapon.damage = 50;
    weapon.range = 300;
    weapon.arc = 90;
    weapon.angle = 0;
    ship.weapons.set(weapon.weaponId, weapon);
    
    this.state.ships.set(ship.id, ship);
    console.log(`Created test ship: ${ship.id} at (${x}, ${y})`);
  }
}
