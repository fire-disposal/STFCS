/**
 * 简化的 WebSocket 消息协议
 *
 * 设计原则：
 * 1. 通用消息结构：{ type, payload, id? }
 * 2. 类型安全通过 TypeScript 的 discriminated union
 * 3. 快速开发：添加新消息只需定义 type 常量 + payload 类型
 */

// ==================== 基础结构 ====================

/** 通用消息 */
export interface WSMessage<T = unknown> {
	type: string;
	payload: T;
	/** 可选的请求ID，用于请求-响应匹配 */
	id?: string;
}

/** 错误负载 */
export interface ErrorPayload {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

// ==================== 消息类型常量 ====================

export const MsgType = {
	// 连接/会话
	CONNECT: "connect",
	CONNECTED: "connected",
	HEARTBEAT: "heartbeat",
	HEARTBEAT_ACK: "heartbeat_ack",
	DISCONNECT: "disconnect",

	// 房间管理
	ROOM_LIST: "room:list",
	ROOM_LIST_RESULT: "room:list_result",
	ROOM_CREATE: "room:create",
	ROOM_CREATED: "room:created",
	ROOM_JOIN: "room:join",
	ROOM_JOINED: "room:joined",
	ROOM_LEAVE: "room:leave",
	ROOM_LEFT: "room:left",
	ROOM_DELETE: "room:delete",
	ROOM_DELETED: "room:deleted",
	ROOM_SAVE: "room:save",
	ROOM_SAVED: "room:saved",
	ROOM_LOAD: "room:load",
	ROOM_LOADED: "room:loaded",

	// 游戏命令
	GAME_MOVE: "game:move",
	GAME_ROTATE: "game:rotate",
	GAME_ATTACK: "game:attack",
	GAME_TOGGLE_SHIELD: "game:toggle_shield",
	GAME_VENT_FLUX: "game:vent_flux",
	GAME_END_TURN: "game:end_turn",
	GAME_COMMAND_RESULT: "game:command_result",

	// 移动阶段控制
	GAME_ADVANCE_PHASE: "game:advance_phase",
	GAME_PHASE_ADVANCED: "game:phase_advanced",
	GAME_MOVEMENT_STATUS: "game:movement_status",

	// 武器目标查询
	GAME_QUERY_TARGETS: "game:query_targets",
	GAME_TARGETS_RESULT: "game:targets_result",

	// 运行时数据修改（DM / 玩家自由编辑）
	DATA_UPDATE: "data:update",
	DATA_UPDATE_RESULT: "data:update_result",
	DATA_CREATE: "data:create",
	DATA_DELETE: "data:delete",
	DATA_CHANGES: "data:changes", // 广播变更

	// 状态同步
	STATE_FULL: "state:full",
	STATE_DELTA: "state:delta",
	EVENT: "event",

	// 玩家档案
	PLAYER_PROFILE: "player:profile",
	PLAYER_SHIPS: "player:ships",
	PLAYER_WEAPONS: "player:weapons",
	SHIP_DETAILS: "ship:details",
	CUSTOM_SHIP_CREATED: "ship:custom_created",
	SHIP_UPDATED: "ship:updated",
	PRESET_RESTORED: "preset:restored",
	SAVE_CREATED: "save:created",
	SAVE_LOADED: "save:loaded",
	SAVE_LIST: "save:list",
	SAVE_INFO: "save:info",
	SAVE_STATS: "save:stats",
	SAVE_COUNT: "save:count",
	SAVE_UPDATED: "save:updated",
	SAVE_DELETED: "save:deleted",
	SAVES_DELETED: "saves:deleted",
	SAVE_DUPLICATED: "save:duplicated",
	SAVE_EXPORT: "save:export",
	SAVE_IMPORTED: "save:imported",
	SAVES_CLEANED: "saves:cleaned",
	
	// 资产/贴图管理
	ASSET_UPLOAD: "asset:upload",
	ASSET_UPLOADED: "asset:uploaded",
	AVATAR_UPLOAD: "avatar:upload",
	AVATAR_UPLOADED: "avatar:uploaded",
	TEXTURE_UPLOAD: "texture:upload",
	TEXTURE_UPLOADED: "texture:uploaded",
	ASSET_GET: "asset:get",
	ASSET_DETAILS: "asset:details",
	ASSET_DATA: "asset:data",
	ASSET_INFO: "asset:info",
	ASSET_LIST: "asset:list",
	ASSET_STATS: "asset:stats",
	ASSET_UPDATE: "asset:update",
	ASSET_UPDATED: "asset:updated",
	ASSET_DELETE: "asset:delete",
	ASSET_DELETED: "asset:deleted",
	ASSET_SHARE: "asset:share",
	ASSET_SHARED: "asset:shared",
	ASSET_MAKE_PUBLIC: "asset:make_public",
	ASSET_MADE_PUBLIC: "asset:made_public",
	ASSET_MAKE_PRIVATE: "asset:make_private",
	ASSET_MADE_PRIVATE: "asset:made_private",
	
	// 头像特定操作
	AVATAR_GET: "avatar:get",
	AVATAR_DETAILS: "avatar:details",
	AVATAR_NOT_FOUND: "avatar:not_found",
	AVATAR_DATA: "avatar:data",
	AVATAR_LIST: "avatar:list",
	
	// 对象创建
	OBJECT_CREATE: "object:create",
	OBJECT_CREATED: "object:created",
	OBJECT_CREATE_FROM_PROFILE: "object:create_from_profile",

	// 错误
	ERROR: "error",
} as const;

// ==================== 连接层 Payload ====================

export interface ConnectPayload {
	clientVersion: string;
	playerName: string;
}

export interface ConnectedPayload {
	serverVersion: string;
	sessionId: string;
	serverTime: number;
}

export interface HeartbeatPayload {
	clientTime: number;
	sequence: number;
}

export interface HeartbeatAckPayload {
	clientTime: number;
	serverTime: number;
	latency: number;
	sequence: number;
}

// ==================== 房间层 Payload ====================

export interface RoomListPayload {
	filter?: {
		status?: "open" | "full" | "in_progress";
	};
}

export interface RoomInfo {
	id: string;
	name: string;
	playerCount: number;
	maxPlayers: number;
	status: string;
	phase: string;
}

export interface RoomListResultPayload {
	rooms: RoomInfo[];
}

export interface RoomCreatePayload {
	name: string;
	maxPlayers?: number;
	mapWidth?: number;
	mapHeight?: number;
}

export interface RoomCreatedPayload {
	roomId: string;
	name: string;
	joinToken: string;
}

export interface RoomJoinPayload {
	roomId: string;
	joinToken?: string;
	faction?: string;
}

export interface RoomJoinedPayload {
	roomId: string;
	playerId: string;
	roomInfo: RoomListResultPayload["rooms"][number];
	players: Array<{
		id: string;
		name: string;
		faction: string;
		ready: boolean;
	}>;
}

export interface RoomLeavePayload {
	roomId: string;
}

export interface RoomSavePayload {
	roomId: string;
	saveName: string;
}

export interface RoomLoadPayload {
	saveId: string;
}

// ==================== 游戏命令 Payload ====================

export interface GameMovePayload {
	/** 前后移动距离（正=前，负=后，0=不移动） */
	forwardDistance?: number;
	/** 侧向移动距离（正=左，负=右，0=不移动） */
	strafeDistance?: number;
}

export interface GameRotatePayload {
	/** 旋转角度（整数，正=顺时针，负=逆时针） */
	angle: number;
}

export interface GameAdvancePhasePayload {
	shipId: string;
}

export interface GameAttackPayload {
	/** 攻击者舰船ID */
	attackerId: string;
	/** 武器攻击分配列表 */
	weaponAllocations: Array<{
		/** 武器挂载ID */
		mountId: string;
		/** 目标分配 */
		targets: Array<{
			/** 目标舰船ID */
			targetId: string;
			/** 分配到此目标的射击数（弹丸/连射） */
			shotCount: number;
			/** 目标象限（可选） */
			targetQuadrant?: number;
		}>;
	}>;
}

export interface GameCommandResultPayload {
	success: boolean;
	command: string;
	data?: Record<string, unknown>;
	error?: ErrorPayload;
}

export interface GameQueryTargetsPayload {
	shipId: string;
}

export interface GameTargetsResultPayload {
	shipId: string;
	shipName: string;
	canAttack: boolean;
	cannotAttackReason?: string;
	weapons: Array<{
		mountId: string;
		weaponName: string;
		weaponSpec: string;
		state: string;
		isReady: boolean;
		range: number;
		minRange: number;
		arc: number;
		mountFacing: number;
		damage: number;
		burstCount: number;
		projectilesPerShot: number;
		allowsMultipleTargets: boolean;
		isAvailable: boolean;
		unavailableReason?: string;
		/** UI状态（用于前端指示灯） */
		uiStatus: "FIRED" | "UNAVAILABLE" | "READY" | "READY_WITH_TARGETS";
		/** UI状态说明 */
		uiStatusLabel: string;
		validTargets: Array<{
			targetId: string;
			targetName: string;
			distance: number;
			inRange: boolean;
			inArc: boolean;
			hitAngle: number;
			targetQuadrant: number;
		}>;
	}>;
}

// ==================== 状态同步 Payload ====================

export interface StateFullPayload {
	gameState: Record<string, unknown>;
}

export interface StateDeltaPayload {
	changes: Array<{
		path: string;
		value: unknown;
	}>;
}

export interface EventPayload {
	eventType: string;
	data: Record<string, unknown>;
}

// ==================== 攻击结果 Payload ====================

export interface AttackResultPayload {
	/** 攻击者ID */
	attackerId: string;
	/** 攻击结果 */
	results: Array<{
		/** 武器挂载ID */
		mountId: string;
		/** 目标ID */
		targetId: string;
		/** 是否命中 */
		hit: boolean;
		/** 伤害值 */
		damage: number;
		/** 是否命中护盾 */
		shieldHit: boolean;
		/** 是否命中护甲 */
		armorHit: boolean;
		/** 命中象限 */
		armorQuadrant?: number;
		/** 目标是否被摧毁 */
		targetDestroyed: boolean;
	}>;
	/** 状态更新 */
	stateUpdates?: Record<string, unknown>;
}

export interface AttackErrorPayload {
	/** 错误代码 */
	code: string;
	/** 错误消息 */
	message: string;
	/** 失败的武器分配 */
	failedAllocations?: Array<{
		mountId: string;
		reason: string;
	}>;
}

// ==================== 玩家资料 Payload ====================

export interface ProfileUpdatePayload {
	nickname?: string;
	avatar?: string;
	preferences?: Record<string, unknown>;
}

export interface ProfileResultPayload {
	playerId: string;
	name: string;
	nickname?: string;
	avatar?: string;
	stats?: Record<string, unknown>;
}

// ==================== 运行时数据修改 Payload ====================

export interface DataUpdatePayload {
	/** 对象类型 */
	objectType: "ship" | "token" | "player" | "component";
	/** 对象ID */
	objectId: string;
	/** 路径更新（如 { "runtime.hull": 50, "metadata.name": "New Name" }） */
	updates: Record<string, unknown>;
	/** 是否完整替换（DM 专用，可选） */
	replace?: boolean;
}

export interface DataUpdateResultPayload {
	/** 是否成功 */
	success: boolean;
	/** 对象类型 */
	objectType: string;
	/** 对象ID */
	objectId: string;
	/** 应用的变更列表 */
	changes: Array<{
		path: string;
		oldValue?: unknown;
		newValue?: unknown;
	}>;
	/** 错误信息 */
	error?: string;
}

export interface DataChangesPayload {
	/** 变更来源（玩家ID或"DM"） */
	source: string;
	/** 来源角色 */
	role: string;
	/** 对象类型 */
	objectType: string;
	/** 对象ID */
	objectId: string;
	/** 对象名称 */
	objectName?: string;
	/** 变更列表 */
	changes: Array<{
		path: string;
		oldValue?: unknown;
		newValue?: unknown;
		description: string;
	}>;
	/** 时间戳 */
	timestamp: number;
}

export interface DataCreatePayload {
	/** 对象类型 */
	objectType: "ship" | "component";
	/** 初始数据（完整JSON） */
	data: Record<string, unknown>;
	/** 位置（舰船专用） */
	position?: { x: number; y: number };
	/** 阵营（舰船专用） */
	faction?: string;
	/** 拥有者（舰船专用，可选） */
	ownerId?: string;
}

export interface DataCreateResultPayload {
	/** 是否成功 */
	success: boolean;
	/** 新对象ID */
	objectId?: string;
	/** 新对象数据 */
	objectData?: Record<string, unknown>;
	/** 错误信息 */
	error?: string;
}

export interface DataDeletePayload {
	/** 对象类型 */
	objectType: "ship" | "token" | "component";
	/** 对象ID */
	objectId: string;
}

// ==================== 工具函数 ====================

/**
 * 创建消息
 */
export function msg<T>(type: string, payload: T, id?: string): WSMessage<T> {
	return { type, payload, ...(id ? { id } : {}) };
}

/**
 * 创建错误消息
 */
export function errMsg(code: string, message: string, requestId?: string): WSMessage<ErrorPayload> {
	return msg(MsgType.ERROR, { code, message }, requestId);
}

/**
 * 解析消息（安全）
 */
export function parseMsg(raw: string): WSMessage | null {
	try {
		const data = JSON.parse(raw) as unknown;
		if (!data || typeof data !== "object") return null;
		if (!("type" in data) || typeof data.type !== "string") return null;
		if (!("payload" in data)) return null;
		const record = data as Record<string, unknown>;
		return {
			type: record["type"] as string,
			payload: record["payload"],
			...(typeof record["id"] === "string" ? { id: record["id"] } : {}),
		};
	} catch {
		return null;
	}
}

/**
 * 序列化消息
 */
export function serializeMsg(message: WSMessage): string {
	return JSON.stringify(message);
}
