/**
 * 消息处理器
 */

import type { Client } from "@colyseus/core";
import {
	ClientCommand,
	PlayerRole,
	type ClearOverloadPayload,
	type AdvanceMovePhasePayload,
	type SetArmorPayload,
	type AssignShipPayload,
	type ChatPayload,
	type CreateObjectPayload,
	type FireWeaponPayload,
	type MoveTokenPayload,
	type NetPingPayload,
	type ToggleReadyPayload,
	type ToggleShieldPayload,
	type VentFluxPayload,
} from "@vt/types";
import type { CommandDispatcher } from "../commands/CommandDispatcher.js";
import { toErrorDto, toNetPongDto, toRoomKickedDto } from "../dto/index.js";
import { advancePhase } from "../phase/PhaseManager.js";
import type { GameRoomState } from "../schema/GameSchema.js";
import type { RoomEventLogger } from "../utils/ColyseusMessaging.js";

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
}

interface UpdateProfilePayload {
	nickname?: string;
	avatar?: string;
}

interface KickPlayerPayload {
	targetSessionId: string;
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

	onMessage("chat", (client, p: ChatPayload) => {
		const player = ctx.state.players.get(client.sessionId);
		const content = typeof p.content === "string" ? p.content.trim() : "";
		if (!content) {
			return client.send("error", toErrorDto("聊天内容不能为空"));
		}
		if (content.length > 200) {
			return client.send("error", toErrorDto("聊天内容过长"));
		}
		ctx.logger.addChatMessage(
			client.sessionId,
			player?.nickname || player?.name || "Unknown",
			content
		);
	});

	onMessage(ClientCommand.CMD_MOVE_TOKEN, (client, p: MoveTokenPayload) => {
		try {
			ctx.dispatcher.dispatchMoveToken(client, p);
		} catch (e) {
			client.send("error", toErrorDto((e as Error).message));
		}
	});

	onMessage(ClientCommand.CMD_TOGGLE_SHIELD, (client, p: ToggleShieldPayload) => {
		try {
			ctx.dispatcher.dispatchToggleShield(client, p);
		} catch (e) {
			client.send("error", toErrorDto((e as Error).message));
		}
	});

	onMessage(ClientCommand.CMD_FIRE_WEAPON, (client, p: FireWeaponPayload) => {
		try {
			ctx.dispatcher.dispatchFireWeapon(client, p);
		} catch (e) {
			client.send("error", toErrorDto((e as Error).message));
		}
	});

	onMessage(ClientCommand.CMD_VENT_FLUX, (client, p: VentFluxPayload) => {
		try {
			ctx.dispatcher.dispatchVentFlux(client, p);
		} catch (e) {
			client.send("error", toErrorDto((e as Error).message));
		}
	});

	onMessage(ClientCommand.CMD_ASSIGN_SHIP, (client, p: AssignShipPayload) => {
		try {
			ctx.dispatcher.dispatchAssignShip(client, p.shipId, p.targetSessionId);
		} catch (e) {
			client.send("error", toErrorDto((e as Error).message));
		}
	});

	onMessage(ClientCommand.CMD_TOGGLE_READY, (client, p: ToggleReadyPayload) => {
		const player = ctx.state.players.get(client.sessionId);
		if (player) player.isReady = p.isReady;
	});

	onMessage(ClientCommand.CMD_NEXT_PHASE, (client) => {
		const player = ctx.state.players.get(client.sessionId);
		if (player?.role === PlayerRole.DM) {
			advancePhase(ctx.state, ctx.broadcast);
			ctx.setMetadata();
		} else client.send("error", toErrorDto("仅 DM 可强制进入下一阶段"));
	});

	onMessage(ClientCommand.CMD_CREATE_OBJECT, (client, p: CreateObjectPayload) => {
		const player = ctx.state.players.get(client.sessionId);
		if (!player || player.role !== PlayerRole.DM) {
			return client.send("error", toErrorDto("仅 DM 可创建对象"));
		}
		ctx.createObject(p);
	});

	onMessage(ClientCommand.CMD_CLEAR_OVERLOAD, (client, p: ClearOverloadPayload) => {
		const player = ctx.state.players.get(client.sessionId);
		if (!player || player.role !== PlayerRole.DM) {
			return client.send("error", toErrorDto("仅 DM 可清除过载"));
		}
		const ship = ctx.state.ships.get(p.shipId);
		if (!ship) return client.send("error", toErrorDto("舰船不存在"));
		ship.isOverloaded = false;
		ship.overloadTime = 0;
		ship.flux.hard = 0;
		ship.flux.soft = 0;
		ship.flux.hardFlux = 0;
		ship.flux.softFlux = 0;
		ship.shield.deactivate();
	});

	onMessage(ClientCommand.CMD_SET_ARMOR, (client, p: SetArmorPayload) => {
		const player = ctx.state.players.get(client.sessionId);
		if (!player || player.role !== PlayerRole.DM) {
			return client.send("error", toErrorDto("仅 DM 可修改护甲"));
		}
		const ship = ctx.state.ships.get(p.shipId);
		if (!ship) return client.send("error", toErrorDto("舰船不存在"));
		if (p.section < 0 || p.section > 5)
			return client.send("error", toErrorDto("护甲象限无效"));
		ship.armor.setQuadrant(p.section, p.value);
	});

	onMessage(ClientCommand.CMD_ADVANCE_MOVE_PHASE, (client, p: AdvanceMovePhasePayload) => {
		try {
			const ship = ctx.state.ships.get(p.shipId);
			if (!ship) throw new Error("舰船不存在");
			ctx.dispatcher.dispatchAdvanceMovePhase(client, ship);
		} catch (e) {
			client.send("error", toErrorDto((e as Error).message));
		}
	});

	onMessage("NET_PING", (client, p: NetPingPayload) => {
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

	onMessage("ROOM_UPDATE_PROFILE", (client, p: UpdateProfilePayload) => {
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

	onMessage("ROOM_KICK_PLAYER", (client, p: KickPlayerPayload) => {
		if (client.sessionId !== ctx.getRoomOwnerId())
			return client.send("error", toErrorDto("仅房主可踢出"));
		const target = room.clients.find((c) => c.sessionId === p.targetSessionId);
		target?.send("ROOM_KICKED", toRoomKickedDto("被移出"));
		target?.leave(4001);
	});
}
