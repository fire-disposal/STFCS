/**
 * 消息处理器
 */

import type { Client } from "@colyseus/core";
import { ClientCommand, PlayerRole } from "../schema/types.js";
import type { CreateObjectPayload, MoveTokenPayload } from "../commands/types.js";
import type { CommandDispatcher } from "../commands/CommandDispatcher.js";
import { toErrorDto, toNetPongDto, toRoomKickedDto } from "../dto/index.js";
import { advancePhase } from "../phase/PhaseManager.js";
import type { GameRoomState } from "../schema/GameSchema.js";
import type { RoomEventLogger } from "../utils/ColyseusMessaging.js";
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
	parseUpdateProfilePayload,
} from "../validation/messagePayloads.js";

interface Context {
	state: GameRoomState;
	dispatcher: CommandDispatcher;
	logger: RoomEventLogger;
	broadcast: (type: string, data: unknown) => void;
	pingEwma: Map<string, number>;
	jitterEwma: Map<string, number>;
	getRoomOwnerId: () => string | null;
	setMetadata: () => void;
	profileStore: Map<number, { nickname: string; avatar: string }>;
	createObject: (payload: CreateObjectPayload) => void;
	enqueueMoveCommand: (client: Client, payload: MoveTokenPayload) => void;
	dissolveRoom: () => void;
}

export function registerMessageHandlers(
	room: {
		state: GameRoomState;
		clients: Client[];
		broadcast: (type: string, data: unknown) => void;
	},
	ctx: Context
): void {
	interface MessageRoom {
		onMessage(type: string, handler: (client: Client, payload: unknown) => void): void;
	}
	const messageRoom = room as unknown as MessageRoom;

	const onMessage = <TPayload>(
		type: string,
		handler: (client: Client, payload: TPayload) => void
	) => {
		messageRoom.onMessage(type, handler as (client: Client, payload: unknown) => void);
	};

	const handleMessage = (
		client: Client,
		handler: () => void,
		onError: (error: Error) => string = (error) => error.message
	) => {
		try {
			handler();
		} catch (error) {
			client.send("error", toErrorDto(onError(error as Error)));
		}
	};

	onMessage(ClientCommand.CMD_MOVE_TOKEN, (client, payload) => {
		handleMessage(client, () => {
			const p = parseMoveTokenPayload(payload);
			ctx.enqueueMoveCommand(client, p);
		});
	});

	onMessage(ClientCommand.CMD_TOGGLE_SHIELD, (client, payload) => {
		handleMessage(client, () => {
			const p = parseToggleShieldPayload(payload);
			ctx.dispatcher.dispatchToggleShield(client, p);
		});
	});

	onMessage(ClientCommand.CMD_FIRE_WEAPON, (client, payload) => {
		handleMessage(client, () => {
			const p = parseFireWeaponPayload(payload);
			ctx.dispatcher.dispatchFireWeapon(client, p);
		});
	});

	onMessage(ClientCommand.CMD_VENT_FLUX, (client, payload) => {
		handleMessage(client, () => {
			const p = parseShipIdPayload(payload, "辐能排散命令格式错误");
			ctx.dispatcher.dispatchVentFlux(client, p);
		});
	});

	onMessage(ClientCommand.CMD_ASSIGN_SHIP, (client, payload) => {
		handleMessage(client, () => {
			const p = parseAssignShipPayload(payload);
			ctx.dispatcher.dispatchAssignShip(client, p.shipId, p.targetSessionId);
		});
	});

	onMessage(ClientCommand.CMD_TOGGLE_READY, (client, payload) => {
		handleMessage(client, () => {
			const p = parseToggleReadyPayload(payload);
			const player = ctx.state.players.get(client.sessionId);
			if (player) player.isReady = p.isReady;
		});
	});

	onMessage(ClientCommand.CMD_NEXT_PHASE, (client) => {
		const player = ctx.state.players.get(client.sessionId);
		if (player?.role === PlayerRole.DM) {
			advancePhase(ctx.state, ctx.broadcast);
			ctx.setMetadata();
		} else client.send("error", toErrorDto("仅 DM 可强制进入下一阶段"));
	});

	onMessage(ClientCommand.CMD_CREATE_OBJECT, (client, payload) => {
		handleMessage(client, () => {
			const p: CreateObjectPayload = parseCreateObjectPayload(payload);
			const player = ctx.state.players.get(client.sessionId);
			if (!player || player.role !== PlayerRole.DM) {
				throw new Error("仅 DM 可创建对象");
			}
			ctx.createObject(p);
		});
	});

	onMessage(ClientCommand.CMD_CLEAR_OVERLOAD, (client, payload) => {
		handleMessage(client, () => {
			const p = parseShipIdPayload(payload, "清除过载命令格式错误");
			const player = ctx.state.players.get(client.sessionId);
			if (!player || player.role !== PlayerRole.DM) {
				throw new Error("仅 DM 可清除过载");
			}
			const ship = ctx.state.ships.get(p.shipId);
			if (!ship) throw new Error("舰船不存在");
			ship.isOverloaded = false;
			ship.overloadTime = 0;
			ship.flux.hard = 0;
			ship.flux.soft = 0;
			ship.shield.deactivate();
		});
	});

	onMessage(ClientCommand.CMD_SET_ARMOR, (client, payload) => {
		handleMessage(client, () => {
			const p = parseSetArmorPayload(payload);
			const player = ctx.state.players.get(client.sessionId);
			if (!player || player.role !== PlayerRole.DM) {
				throw new Error("仅 DM 可修改护甲");
			}
			const ship = ctx.state.ships.get(p.shipId);
			if (!ship) throw new Error("舰船不存在");
			ship.armor.setQuadrant(p.quadrant, p.value);
		});
	});

	onMessage(ClientCommand.CMD_ADVANCE_MOVE_PHASE, (client, payload) => {
		handleMessage(client, () => {
			const p = parseShipIdPayload(payload, "移动阶段推进命令格式错误");
			const ship = ctx.state.ships.get(p.shipId);
			if (!ship) throw new Error("舰船不存在");
			ctx.dispatcher.dispatchAdvanceMovePhase(client, ship);
		});
	});

	onMessage("NET_PING", (client, payload) => {
		handleMessage(client, () => {
			const p = parseNetPingPayload(payload);
			const player = ctx.state.players.get(client.sessionId);
			if (!player?.connected) return;
			const sample = Math.max(0, Date.now() - p.clientSentAt);
			const prev = ctx.pingEwma.get(client.sessionId) ?? -1;
			const rtt = prev < 0 ? sample : prev * 0.8 + sample * 0.2;
			const jitter =
				(ctx.jitterEwma.get(client.sessionId) ?? 0) * 0.7 +
				Math.abs(sample - (prev < 0 ? sample : prev)) * 0.3;
			ctx.pingEwma.set(client.sessionId, rtt);
			ctx.jitterEwma.set(client.sessionId, jitter);
			player.pingMs = Math.round(rtt);
			player.jitterMs = Math.round(jitter);
			player.connectionQuality =
				rtt <= 80 ? "EXCELLENT" : rtt <= 140 ? "GOOD" : rtt <= 220 ? "FAIR" : "POOR";
			client.send(
				"NET_PONG",
				toNetPongDto(p.seq, Date.now(), player.pingMs, player.jitterMs, player.connectionQuality)
			);
		});
	});

	onMessage("ROOM_UPDATE_PROFILE", (client, payload) => {
		handleMessage(client, () => {
			const p = parseUpdateProfilePayload(payload);
			const player = ctx.state.players.get(client.sessionId);
			if (!player) return;
			player.nickname = String(p.nickname || "")
				.trim()
				.slice(0, 24);
			player.avatar =
				String(p.avatar || "👤")
					.trim()
					.slice(0, 4) || "👤";
			ctx.profileStore.set(player.shortId, { nickname: player.nickname, avatar: player.avatar });
		});
	});

	onMessage("ROOM_KICK_PLAYER", (client, payload) => {
		handleMessage(client, () => {
			const p = parseKickPlayerPayload(payload);
			if (client.sessionId !== ctx.getRoomOwnerId()) {
				throw new Error("仅房主可踢出");
			}
			const target = room.clients.find((c) => c.sessionId === p.targetSessionId);
			target?.send("ROOM_KICKED", toRoomKickedDto("被移出"));
			target?.leave(4001);
		});
	});

	onMessage("ROOM_DISSOLVE", (client) => {
		if (client.sessionId !== ctx.getRoomOwnerId()) {
			client.send("error", toErrorDto("仅房主可解散房间"));
			return;
		}
		ctx.dissolveRoom();
	});
}