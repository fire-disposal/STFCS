import { store } from "@/store";
import {
	setConnected,
	setConnecting,
	setPlayerId,
	setRoomId,
	updatePing,
} from "@/store/slices/uiSlice";
import type {
	WSMessage,
	WSMessageType,
	WS_MESSAGE_TYPES,
	PlayerJoinedMessage,
	ShipMovedMessage,
	ChatMessagePayload,
	DrawingAddMessage,
	DrawingClearMessage,
	ShipMovement,
} from "@vt/shared/ws";

export type { WSMessage, WSMessageType };

// 使用共享类型定义
export type PlayerJoinedPayload = PlayerJoinedMessage["payload"];
export type ShipMovedPayload = ShipMovedMessage["payload"];
export type ChatMessagePayloadType = ChatMessagePayload["payload"];
export type DrawingElementPayload = DrawingAddMessage["payload"]["element"];

export interface RoomUpdatePayload {
	roomId: string;
	players: Array<{
		id: string;
		name: string;
		isReady: boolean;
		currentShipId: string | null;
	}>;
}

class WebSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private pingInterval: NodeJS.Timeout | null = null;
	private messageHandlers: Map<WSMessageType, Array<(payload: unknown) => void>> =
		new Map();

	constructor() {
		this.setupMessageHandlers();
	}

	private setupMessageHandlers(): void {
		this.on(WS_MESSAGE_TYPES.PLAYER_JOINED, (payload) => {
			const data = payload as PlayerJoinedPayload;
			console.log("Player joined:", data);
			// 这里可以分发到Redux store
		});

		this.on(WS_MESSAGE_TYPES.PLAYER_LEFT, (payload) => {
			const playerId = payload as { playerId: string; reason?: string };
			console.log("Player left:", playerId);
		});

		this.on(WS_MESSAGE_TYPES.SHIP_MOVED, (payload) => {
			const data = payload as ShipMovedPayload;
			console.log("Ship moved:", data);
		});

		this.on(WS_MESSAGE_TYPES.CHAT_MESSAGE, (payload) => {
			const data = payload as ChatMessagePayloadType;
			console.log("Chat message:", data);
		});

		this.on("PONG", () => {
			store.dispatch(updatePing());
		});

		this.on("ROOM_UPDATE", (payload) => {
			const data = payload as RoomUpdatePayload;
			console.log("Room updated:", data);
		});
	}

	public connect(url: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				resolve();
				return;
			}

			store.dispatch(setConnecting(true));

			try {
				this.ws = new WebSocket(url);

				this.ws.onopen = () => {
					console.log("WebSocket connected to:", url);
					store.dispatch(setConnected(true));
					store.dispatch(setConnecting(false));
					this.reconnectAttempts = 0;
					this.startPingInterval();
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const message: WSMessage = JSON.parse(event.data);
						this.handleMessage(message);
					} catch (error) {
						console.error("Failed to parse WebSocket message:", error);
					}
				};

				this.ws.onerror = (error) => {
					console.error("WebSocket error:", error);
					store.dispatch(setConnecting(false));
					reject(new Error("WebSocket connection failed"));
				};

				this.ws.onclose = (event) => {
					console.log("WebSocket closed:", event.code, event.reason);
					store.dispatch(setConnected(false));
					this.stopPingInterval();
					this.attemptReconnect(url);
				};
			} catch (error) {
				store.dispatch(setConnecting(false));
				reject(error);
			}
		});
	}

	public disconnect(): void {
		if (this.ws) {
			this.ws.close(1000, "Client disconnected");
			this.ws = null;
		}
		this.stopPingInterval();
		store.dispatch(setConnected(false));
		store.dispatch(setPlayerId(null));
		store.dispatch(setRoomId(null));
	}

	public send(message: WSMessage): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			console.warn("WebSocket is not connected");
		}
	}

	public sendPlayerJoined(playerId: string, playerName: string, roomId: string): void {
		const message: PlayerJoinedMessage = {
			type: WS_MESSAGE_TYPES.PLAYER_JOINED,
			payload: {
				id: playerId,
				name: playerName,
				joinedAt: Date.now(),
			},
		};
		this.send(message as WSMessage);
	}

	public sendShipMovement(movement: ShipMovement): void {
		const message: ShipMovedMessage = {
			type: WS_MESSAGE_TYPES.SHIP_MOVED,
			payload: movement,
		};
		this.send(message);
	}

	public sendChatMessage(
		content: string,
		senderId: string,
		senderName: string,
		type: "player" | "system" | "combat" = "player",
	): void {
		const message: WSMessage = {
			type: "CHAT_MESSAGE",
			payload: {
				id: `chat_${Date.now()}`,
				content,
				senderId,
				senderName,
				timestamp: Date.now(),
				type,
			},
			timestamp: Date.now(),
		};
		this.send(message);
	}

	public sendDrawingElement(element: DrawingElementPayload): void {
		const message: WSMessage = {
			type: "DRAWING_ADD",
			payload: element,
			timestamp: Date.now(),
		};
		this.send(message);
	}

	public sendDrawingClear(): void {
		const message: WSMessage = {
			type: "DRAWING_CLEAR",
			payload: { clearAll: true },
			timestamp: Date.now(),
		};
		this.send(message);
	}

	public on(type: WSMessageType, handler: (payload: unknown) => void): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, []);
		}
		this.messageHandlers.get(type)!.push(handler);
	}

	public off(type: WSMessageType, handler: (payload: unknown) => void): void {
		const handlers = this.messageHandlers.get(type);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index > -1) {
				handlers.splice(index, 1);
			}
		}
	}

	private handleMessage(message: WSMessage): void {
		const handlers = this.messageHandlers.get(message.type);
		if (handlers) {
			handlers.forEach((handler) => handler(message.payload));
		}
	}

	private startPingInterval(): void {
		this.pingInterval = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				const message: WSMessage = {
					type: "PING",
					payload: { timestamp: Date.now() },
					timestamp: Date.now(),
				};
				this.send(message);
			}
		}, 30000); // 每30秒发送一次ping
	}

	private stopPingInterval(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	private attemptReconnect(url: string): void {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.reconnectAttempts++;
			const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

			console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

			setTimeout(() => {
				this.connect(url).catch((error) => {
					console.error("Reconnection failed:", error);
				});
			}, delay);
		} else {
			console.log("Max reconnection attempts reached");
		}
	}

	public isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	public getConnectionState(): number {
		return this.ws?.readyState ?? WebSocket.CLOSED;
	}
}

export const websocketService = new WebSocketService();
