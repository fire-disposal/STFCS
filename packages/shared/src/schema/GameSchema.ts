import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";

// 重新导出 ArraySchema 供其他包使用
export { ArraySchema };

/**
 * 变换组件 - 包含位置与朝向
 */
export class Transform extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") heading: number = 0; // 朝向 0-359度
}

/**
 * 武器槽位数据
 */
export class WeaponSlot extends Schema {
  @type("string") weaponId: string = "";
  @type("string") type: "kinetic" | "high_explosive" | "energy" | "fragmentation" = "kinetic";
  @type("number") cooldown: number = 0;
  @type("number") damage: number = 0;
  @type("number") range: number = 0;
  @type("number") arc: number = 0; // 射界角度
  @type("number") angle: number = 0; // 相对舰体的安装角度
}

export type WeaponDamageType = "kinetic" | "high_explosive" | "energy" | "fragmentation";

export type ConnectionQuality = "excellent" | "good" | "fair" | "poor" | "offline";

export enum ClientCommand {
  CMD_MOVE_TOKEN = "CMD_MOVE_TOKEN",
  CMD_TOGGLE_SHIELD = "CMD_TOGGLE_SHIELD",
  CMD_FIRE_WEAPON = "CMD_FIRE_WEAPON",
  CMD_VENT_FLUX = "CMD_VENT_FLUX",
  CMD_ASSIGN_SHIP = "CMD_ASSIGN_SHIP",
  CMD_TOGGLE_READY = "CMD_TOGGLE_READY",
  CMD_NEXT_PHASE = "CMD_NEXT_PHASE",
}

export const DAMAGE_MULTIPLIERS: Record<WeaponDamageType, { shield: number; armor: number; hull: number }> = {
  kinetic: { shield: 0.5, armor: 2, hull: 1 },
  high_explosive: { shield: 0.5, armor: 0.5, hull: 1 },
  energy: { shield: 1, armor: 1, hull: 1 },
  fragmentation: { shield: 0.25, armor: 0.25, hull: 0.25 },
};

export const GAME_CONFIG = {
  SHIELD_UP_FLUX_COST: 10,
  OVERLOAD_BASE_DURATION: 10,
  VENT_FLUX_RATE: 30,
  OVERLOAD_FLUX_DECAY: 20,
} as const;

/**
 * 玩家状态模型
 */
export class PlayerState extends Schema {
  @type("string") sessionId: string = "";
  @type("string") role: "dm" | "player" = "player";
  @type("string") name: string = "";
  @type("boolean") isReady: boolean = false;
  @type("boolean") connected: boolean = true;
  @type("number") pingMs: number = -1;
  @type("number") jitterMs: number = 0;
  @type("string") connectionQuality: ConnectionQuality = "offline";
  @type(["string"]) abilities = new ArraySchema<string>();
}

/**
 * 战舰状态主模型
 */
export class ShipState extends Schema {
  @type("string") id: string = "";
  @type("string") ownerId: string = ""; // 持有该舰船的玩家 sessionId
  @type("string") faction: "player" | "dm" = "player";
  @type("string") hullType: string = "";
  
  @type(Transform) transform = new Transform();
  
  // 装甲与血量 - 6象限装甲 (前、前右、后右、后、后左、前左)
  @type("number") hullCurrent: number = 0;
  @type("number") hullMax: number = 0;
  @type(["number"]) armorCurrent = new ArraySchema<number>(0, 0, 0, 0, 0, 0);
  @type(["number"]) armorMax = new ArraySchema<number>(0, 0, 0, 0, 0, 0);
  
  // 护盾与辐能
  @type("number") fluxMax: number = 0;
  @type("number") fluxDissipation: number = 0; // 辐能消散率
  @type("number") fluxHard: number = 0; // 硬辐能
  @type("number") fluxSoft: number = 0; // 软辐能
  @type("boolean") isShieldUp: boolean = false;
  @type("number") shieldOrientation: number = 0; // 护盾朝向
  @type("number") shieldArc: number = 120; // 护盾弧宽
  @type("boolean") isOverloaded: boolean = false;
  @type("number") overloadTime: number = 0; // 剩余过载时间
  
  // 机动参数
  @type("number") maxSpeed: number = 0; // 最大速度 (X)
  @type("number") maxTurnRate: number = 0; // 最大转向率 (Y)
  @type("number") acceleration: number = 0; // 加速度
  
  // 回合机动记录 (三阶段移动)
  @type("number") movePhaseAX: number = 0; // 阶段A前进距离
  @type("number") movePhaseAStrafe: number = 0; // 阶段A侧移距离
  @type("number") movePhaseBX: number = 0; // 阶段B前进距离
  @type("number") movePhaseBStrafe: number = 0; // 阶段B侧移距离
  @type("number") turnAngle: number = 0; // 转向角度
  
  // 子系统挂载
  @type({ map: WeaponSlot }) weapons = new MapSchema<WeaponSlot>();
  
  // 当前回合机动记录
  @type("boolean") hasMoved: boolean = false;
  @type("boolean") hasFired: boolean = false;
}

/**
 * 游戏阶段枚举
 */
export type GamePhase = "DEPLOYMENT" | "PLAYER_TURN" | "DM_TURN" | "END_PHASE";

/**
 * 全局房间状态模型
 */
export class GameRoomState extends Schema {
  @type("string") currentPhase: GamePhase = "DEPLOYMENT";
  @type("number") turnCount: number = 1;

  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: ShipState }) ships = new MapSchema<ShipState>();

  @type("string") activeFaction: "player" | "dm" = "player";
  @type("number") mapWidth: number = 2000;
  @type("number") mapHeight: number = 2000;
}
