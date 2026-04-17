/**
 * 消息通信控制器 (Message Controller)
 * 
 * 职责：
 * 1. 定义消息协议入口 (onMessage)
 * 2. 负责 Payload 基础解析与校验 (Validation)
 * 3. 将合法请求转发至 CommandDispatcher 执行业务逻辑
 * 4. 隔离 Colyseus 原始消息与内部领域逻辑
 */

import type { Client } from "@colyseus/core";
import { ClientCommand, PlayerRole } from "@vt/data";
import { toErrorDto, toNetPongDto, toRoomKickedDto } from "../dto/index.js";
import type { GameRoomState } from "../schema/GameSchema.js";
import type { RoomEventLogger } from "../utils/ColyseusMessaging.js";
import type { PlayerService } from "../services/PlayerService.js";
import type { CommandDispatcher } from "./CommandDispatcher.js";
import type { CreateObjectPayload, MoveTokenPayload } from "./types.js";
import {
	parseAssignShipPayload,
	parseCreateObjectPayload,
	parseFireWeaponPayload,
	parseKickPlayerPayload,
	parseMoveTokenPayload,
	parseNetPingPayload,
	parseSetArmorPayload,
	parseShipIdPayload,
	parseToggleReadyPayload,
	parseToggleShieldPayload,
	parseTransferOwnerPayload,
	parseUpdateProfilePayload,
} from "../validation/messagePayloads.js";

interface ControllerContext {
	state: GameRoomState;
	dispatcher: CommandDispatcher;
	playerService: PlayerService;
	logger: RoomEventLogger;
	broadcast: (type: string, data: unknown) => void;
	pingEwma: Map<string, number>;
	jitterEwma: Map<string, number>;
	getRoomOwnerId: () => string | null;
	setMetadata: () => void;
	createObject: (payload: CreateObjectPayload) => void;
	enqueueMoveCommand: (client: Client, payload: MoveTokenPayload) => void;
	dissolveRoom: () => void;
	saveGame: (name: string) => Promise<string>;
	loadGame: (saveId: string) => Promise<boolean>;
	transferOwner: (targetSessionId: string) => { success: boolean; error?: string };
}

export function registerMessageController(
	room: {
		state: GameRoomState;
		clients: Client[];
		onMessage(type: string, handler: (client: Client, payload: unknown) => void): void;
		broadcast: (type: string, data: unknown) => void;
	},
	ctx: ControllerContext
): void {
	// 基础能力分片注册
	registerActionHandlers(room, ctx);
	registerQueryHandlers(room, ctx);
	registerProfileHandlers(room, ctx);
	registerManagementHandlers(room, ctx);
	registerUtilityHandlers(room, ctx);
}

/** 统一消息处理包装 */
function handle(
	client: Client,
	handler: () => void | Promise<void>
) {
	try {
		const result = handler();
		if (result instanceof Promise) {
			result.catch((error) => {
				console.error(`[MessageController] Async error during message handling:`, error);
				client.send("error", toErrorDto(error.message));
			});
		}
	} catch (error) {
		console.error(`[MessageController] Sync error during message handling:`, error);
		client.send("error", toErrorDto((error as Error).message));
	}
}

// ==================== 1. 核心游戏行动 ====================

function registerActionHandlers(room: any, ctx: ControllerContext) {
	room.onMessage(ClientCommand.CMD_MOVE_TOKEN, (client: Client, payload: any) => {
		handle(client, () => ctx.enqueueMoveCommand(client, parseMoveTokenPayload(payload)));
	});

	room.onMessage(ClientCommand.CMD_TOGGLE_SHIELD, (client: Client, payload: any) => {
		handle(client, () => ctx.dispatcher.dispatchToggleShield(client, parseToggleShieldPayload(payload)));
	});

	room.onMessage(ClientCommand.CMD_FIRE_WEAPON, (client: Client, payload: any) => {
		handle(client, () => ctx.dispatcher.dispatchFireWeapon(client, parseFireWeaponPayload(payload)));
	});

	room.onMessage(ClientCommand.CMD_VENT_FLUX, (client: Client, payload: any) => {
		handle(client, () => ctx.dispatcher.dispatchVentFlux(client, parseShipIdPayload(payload, "辐能排散命令格式错误")));
	});

	room.onMessage(ClientCommand.CMD_NEXT_PHASE, (client: Client) => {
		handle(client, () => {
			ctx.dispatcher.dispatchAdvancePhase(client, ctx.broadcast);
			ctx.setMetadata();
		});
	});
}

// ==================== 2. 状态查询 ====================

function registerQueryHandlers(room: any, ctx: ControllerContext) {
	room.onMessage(ClientCommand.CMD_GET_ATTACKABLE_TARGETS, (client: Client, payload: any) => {
		handle(client, () => ctx.dispatcher.dispatchQueryTargets(client, payload));
	});

	room.onMessage(ClientCommand.CMD_GET_ALL_ATTACKABLE_TARGETS, (client: Client, payload: any) => {
		handle(client, () => ctx.dispatcher.dispatchQueryAllTargets(client, payload));
	});
}

// ==================== 3. 玩家与档案 ====================

function registerProfileHandlers(room: any, ctx: ControllerContext) {
	room.onMessage(ClientCommand.CMD_UPDATE_PROFILE, (client: Client, payload: any) => {
		handle(client, async () => ctx.dispatcher.dispatchUpdateProfile(client, ctx.playerService, parseUpdateProfilePayload(payload)));
	});

	room.onMessage(ClientCommand.CMD_TOGGLE_READY, (client: Client, payload: any) => {
		handle(client, () => {
			const p = parseToggleReadyPayload(payload);
			const player = ctx.state.players.get(client.sessionId);
			if (player) player.isReady = p.isReady;
		});
	});
}

// ==================== 4. 房间管理 ====================

function registerManagementHandlers(room: any, ctx: ControllerContext) {
	room.onMessage(ClientCommand.CMD_ASSIGN_SHIP, (client: Client, payload: any) => {
		handle(client, () => {
			const p = parseAssignShipPayload(payload);
			ctx.dispatcher.dispatchAssignShip(client, p.shipId, p.targetSessionId);
		});
	});

	room.onMessage(ClientCommand.CMD_CREATE_OBJECT, (client: Client, payload: any) => {
		handle(client, () => ctx.dispatcher.dispatchCreateObject(client, parseCreateObjectPayload(payload), ctx.createObject));
	});

	room.onMessage(ClientCommand.CMD_CLEAR_OVERLOAD, (client: Client, payload: any) => {
		handle(client, () => ctx.dispatcher.dispatchClearOverload(client, parseShipIdPayload(payload, "清除过载命令格式错误").shipId));
	});

	room.onMessage(ClientCommand.CMD_SET_ARMOR, (client: Client, payload: any) => {
		handle(client, () => {
			const p = parseSetArmorPayload(payload);
			ctx.dispatcher.dispatchSetArmor(client, p.shipId, p.quadrant, p.value);
		});
	});

	room.onMessage(ClientCommand.CMD_KICK_PLAYER, (client: Client, payload: any) => {
		handle(client, () => {
			const p = parseKickPlayerPayload(payload);
			if (client.sessionId !== ctx.getRoomOwnerId()) throw new Error("仅房主可踢出");
			const target = room.clients.find((c: Client) => c.sessionId === p.playerId);
			target?.send("ROOM_KICKED", toRoomKickedDto("被移出"));
			target?.leave(4001);
		});
	});

	room.onMessage(ClientCommand.CMD_ROOM_DISSOLVE, (client: Client) => {
		if (client.sessionId !== ctx.getRoomOwnerId()) {
			client.send("error", toErrorDto("仅房主可解散房间"));
			return;
		}
		ctx.dissolveRoom();
	});

	room.onMessage(ClientCommand.CMD_TRANSFER_OWNER, (client: Client, payload: any) => {
		handle(client, () => {
			if (client.sessionId !== ctx.getRoomOwnerId()) throw new Error("仅房主可转移房主身份");
			const p = parseTransferOwnerPayload(payload);
			const result = ctx.transferOwner(p.targetSessionId);
			if (!result.success) throw new Error(result.error || "房主转移失败");
			ctx.setMetadata();
			room.broadcast("owner_transferred", { newOwnerId: p.targetSessionId });
		});
	});

	room.onMessage(ClientCommand.CMD_SAVE_GAME, (client: Client, payload: any) => {
		handle(client, async () => {
			if (client.sessionId !== ctx.getRoomOwnerId()) throw new Error("仅房主可保存游戏");
			await ctx.saveGame(String((payload as any).name || "").trim() || `Save-${Date.now()}`);
		});
	});

	room.onMessage(ClientCommand.CMD_LOAD_GAME, (client: Client, payload: any) => {
		handle(client, async () => {
			if (client.sessionId !== ctx.getRoomOwnerId()) throw new Error("仅房主可加载游戏");
			await ctx.loadGame(String((payload as any).saveId || "").trim());
		});
	});
}

// ==================== 5. 辅助工具 ====================

function registerUtilityHandlers(room: any, ctx: ControllerContext) {
	room.onMessage("NET_PING", (client: Client, payload: any) => {
		handle(client, () => {
			const p = parseNetPingPayload(payload);
			const player = ctx.state.players.get(client.sessionId);
			if (!player?.connected) return;
			const sample = Math.max(0, Date.now() - p.clientSentAt);
			const prev = ctx.pingEwma.get(client.sessionId) ?? -1;
			const rtt = prev < 0 ? sample : prev * 0.8 + sample * 0.2;
			ctx.pingEwma.set(client.sessionId, rtt);
			player.pingMs = Math.round(rtt);
			client.send("NET_PONG", toNetPongDto(p.seq, Date.now(), player.pingMs, 0, "GOOD"));
		});
	});
}
