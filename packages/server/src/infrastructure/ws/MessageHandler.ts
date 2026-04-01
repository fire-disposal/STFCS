import type { AckEnvelope, CommandEnvelope, PatchEnvelope, WSMessage } from "@vt/shared/ws";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import { GLOBAL_ROOM_ID } from "@vt/shared/constants";
import type { PlayerService } from "../../application/player/PlayerService";
import type { SelectionService } from "../../application/selection/SelectionService";
import type { ShipService } from "../../application/ship/ShipService";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";

interface WSSender {
	sendTo: (id: string, msg: WSMessage) => void;
}

export interface MessageHandlerOptions {
	roomManager: RoomManager;
	playerService: PlayerService;
	shipService: ShipService;
	selectionService: SelectionService;
	wsServer?: WSSender;
}

/**
 * 极简通讯主线：只接受 command，并输出 patch + ack。
 * 历史 REQUEST/RESPONSE 体系被视为旧协议，不再处理。
 */
export class MessageHandler {
	private _roomManager: RoomManager;
	private _playerService: PlayerService;
	private _wsServer?: WSSender;
	private _processedCommands: Set<string>;

	constructor(options: MessageHandlerOptions) {
		this._roomManager = options.roomManager;
		this._playerService = options.playerService;
		this._wsServer = options.wsServer;
		this._processedCommands = new Set();
	}

	async handleMessage(clientId: string, message: WSMessage): Promise<void> {
		try {
			if ((message as { type?: string }).type === "command") {
				await this._handleCommandMessage(clientId, message as CommandEnvelope);
				return;
			}

			if (message.type === WS_MESSAGE_TYPES.PING) {
				this._wsServer?.sendTo(clientId, {
					type: WS_MESSAGE_TYPES.PONG,
					payload: { timestamp: Date.now() },
				});
				return;
			}

			this._sendError(clientId, "LEGACY_PROTOCOL_REMOVED", "Only command envelope is accepted");
		} catch (error) {
			this._sendError(
				clientId,
				"MESSAGE_ERROR",
				error instanceof Error ? error.message : "Unknown error",
			);
		}
	}

	private async _handleCommandMessage(clientId: string, command: CommandEnvelope): Promise<void> {
		if (this._processedCommands.has(command.commandId)) {
			this._sendAck(clientId, {
				type: "ack",
				commandId: command.commandId,
				accepted: true,
				message: "duplicate command ignored",
			});
			return;
		}
		this._processedCommands.add(command.commandId);

		switch (command.op) {
			case "session.hello": {
				const payload = command.payload as { name?: string };
				const playerId = command.actorId || `player_${Date.now()}`;
				const playerName = payload.name?.trim() || playerId;
				await this._playerService.join(
					{ id: playerId, name: playerName, joinedAt: Date.now(), isActive: true, isDMMode: false },
					GLOBAL_ROOM_ID,
				);
				const sessionToken = `sess_${playerId}_${Date.now()}`;
				this._roomManager.setSession(sessionToken, playerId, Date.now() + 7 * 24 * 60 * 60 * 1000);
				this._broadcastPatch("session.established", { playerId, sessionToken }, command.commandId, clientId);
				return;
			}
			case "session.resume": {
				const payload = command.payload as { sessionToken?: string };
				const session = payload.sessionToken ? this._roomManager.getSession(payload.sessionToken) : undefined;
				if (!session || session.expiresAt < Date.now()) {
					this._sendAck(clientId, {
						type: "ack",
						commandId: command.commandId,
						accepted: false,
						errorCode: "INVALID_SESSION",
						message: "session expired or not found",
					});
					return;
				}
				this._broadcastPatch("session.resumed", { playerId: session.playerId }, command.commandId, clientId);
				return;
			}
			case "session.leave": {
				await this._playerService.leave(command.actorId, GLOBAL_ROOM_ID);
				this._broadcastPatch("session.left", { playerId: command.actorId }, command.commandId, clientId);
				return;
			}
			case "presence.update": {
				this._broadcastPatch(
					"presence.updated",
					{ playerId: command.actorId, presence: command.payload, at: Date.now() },
					command.commandId,
					clientId,
				);
				return;
			}
			case "state.get": {
				const patch: PatchEnvelope = {
					type: "patch",
					revision: this._roomManager.nextRevision(),
					eventId: `evt_${Date.now()}_${command.commandId}`,
					op: "state.snapshot",
					payload: this._roomManager.getGlobalState(),
					emittedAt: Date.now(),
				};
				this._wsServer?.sendTo(clientId, patch);
				this._sendAck(clientId, { type: "ack", commandId: command.commandId, accepted: true });
				return;
			}
			case "chat.send": {
				const payload = command.payload as { text?: string };
				if (!payload.text?.trim()) {
					this._sendAck(clientId, {
						type: "ack",
						commandId: command.commandId,
						accepted: false,
						errorCode: "BAD_PAYLOAD",
						message: "text is required",
					});
					return;
				}
				const chat = { id: `chat_${Date.now()}`, from: command.actorId, text: payload.text.trim(), at: Date.now() };
				this._roomManager.appendChat(chat);
				this._broadcastPatch("chat.appended", chat, command.commandId, clientId);
				return;
			}
			case "object.upsert": {
				const payload = command.payload as {
					id: string;
					kind: "marker" | "token" | "note";
					position: { x: number; y: number };
					meta?: Record<string, unknown>;
				};
				const updated = { ...payload, updatedAt: Date.now() };
				this._roomManager.upsertObject(updated);
				this._broadcastPatch("object.updated", updated, command.commandId, clientId);
				return;
			}
			case "object.remove": {
				const payload = command.payload as { id: string };
				this._roomManager.removeObject(payload.id);
				this._broadcastPatch("object.removed", payload, command.commandId, clientId);
				return;
			}
			default:
				this._sendAck(clientId, {
					type: "ack",
					commandId: command.commandId,
					accepted: false,
					errorCode: "UNSUPPORTED_OP",
					message: `unsupported op ${command.op}`,
				});
		}
	}

	private _broadcastPatch(op: string, payload: unknown, commandId: string, clientId: string): void {
		const patch: PatchEnvelope = {
			type: "patch",
			revision: this._roomManager.nextRevision(),
			eventId: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
			op,
			payload,
			emittedAt: Date.now(),
		};
		this._roomManager.broadcastToRoom(GLOBAL_ROOM_ID, patch);
		this._sendAck(clientId, { type: "ack", commandId, accepted: true });
	}

	private _sendAck(clientId: string, ack: AckEnvelope): void {
		this._wsServer?.sendTo(clientId, ack);
	}

	private _sendError(clientId: string, code: string, message: string): void {
		this._wsServer?.sendTo(clientId, {
			type: WS_MESSAGE_TYPES.ERROR,
			payload: { code, message },
		});
	}
}

export default MessageHandler;
