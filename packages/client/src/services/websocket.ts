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
	RoomUpdateMessage,
	PingMessage,
	WSMessagePayloadMap,
	PlayerJoinedMessage,
	ShipMovedMessage,
	ChatMessagePayload,
	DrawingAddMessage,
	RequestMessage,
	ResponseMessage,
	RequestOperation,
	ResponseForOperation,
	RequestPayload,
} from "@vt/shared/ws";
import type { ShipMovement } from "@vt/shared/types";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";

export type { WSMessage, WSMessageType };

// 使用共享类型定义
export type PlayerJoinedPayload = PlayerJoinedMessage["payload"];
export type ShipMovedPayload = ShipMovedMessage["payload"];
export type ChatMessagePayloadType = ChatMessagePayload["payload"];
export type DrawingElementPayload = DrawingAddMessage["payload"]["element"];

export type RoomUpdatePayload = RoomUpdateMessage["payload"];

interface PendingRequest {
	resolve: (data: any) => void;
	reject: (error: Error) => void;
	timeout: NodeJS.Timeout;
	operation: RequestOperation;
}

export class WebSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private pingInterval: NodeJS.Timeout | null = null;
	private messageHandlers: Map<WSMessageType, Array<(payload: unknown) => void>> =
		new Map();
	private pendingRequests: Map<string, PendingRequest> = new Map();
	private requestTimeout = 10000; // 10秒超时

	constructor() {
		this.setupMessageHandlers();
	}

	private setupMessageHandlers(): void {
		// 事件处理器
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

		this.on(WS_MESSAGE_TYPES.PONG, () => {
			store.dispatch(updatePing());
		});

		this.on(WS_MESSAGE_TYPES.ROOM_UPDATE, (payload) => {
			const data = payload as RoomUpdatePayload;
			console.log("Room updated:", data);
		});

		// 响应处理器
		this.on(WS_MESSAGE_TYPES.RESPONSE, (payload) => {
			this.handleResponse(payload as ResponseMessage["payload"]);
		});
	}

	private handleResponse(responsePayload: ResponseMessage["payload"]): void {
		const { requestId, ...response } = responsePayload;
		const pending = this.pendingRequests.get(requestId);

		if (!pending) {
			console.warn(`Received response for unknown request ID: ${requestId}`);
			return;
		}

		// 清除超时定时器
		clearTimeout(pending.timeout);
		this.pendingRequests.delete(requestId);

		if (response.success) {
			pending.resolve(response.data);
		} else {
			const error = new Error(response.error.message);
			(error as any).code = response.error.code;
			(error as any).details = response.error.details;
			pending.reject(error);
		}
	}

	/**
	 * 发送请求并等待响应
	 */
	public async sendRequest<T extends RequestOperation>(
		operation: T,
		data: Extract<RequestPayload, { operation: T }>["data"]
	): Promise<ResponseForOperation<T>> {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error("WebSocket is not connected");
		}

		const requestId = this.generateRequestId();
		const requestMessage: RequestMessage = {
			type: WS_MESSAGE_TYPES.REQUEST,
			payload: {
				requestId,
				operation,
				data,
			} as RequestMessage["payload"],
		};

		return new Promise<ResponseForOperation<T>>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(requestId);
				reject(new Error(`Request timeout for operation: ${operation}`));
			}, this.requestTimeout);

			this.pendingRequests.set(requestId, {
				resolve: (data: any) => resolve(data),
				reject,
				timeout,
				operation,
			});

			this.ws!.send(JSON.stringify(requestMessage));
		});
	}

	// 具体操作的便捷方法
	public async joinPlayer(
		playerId: string,
		playerName: string,
		roomId?: string
	): Promise<ResponseForOperation<"player.join">> {
		return this.sendRequest("player.join", {
			id: playerId,
			name: playerName,
			roomId,
		});
	}

	public async leavePlayer(playerId: string, roomId: string): Promise<void> {
		return this.sendRequest("player.leave", { playerId, roomId });
	}

	public async listPlayers(roomId: string): Promise<ResponseForOperation<"player.list">> {
		return this.sendRequest("player.list", { roomId });
	}

	public async moveShip(
		shipId: string,
		phase: 1 | 2 | 3,
		type: "straight" | "strafe" | "rotate",
		distance?: number,
		angle?: number
	): Promise<ResponseForOperation<"ship.move">> {
		return this.sendRequest("ship.move", {
			shipId,
			phase,
			type,
			distance,
			angle,
		});
	}

	public async toggleShield(shipId: string): Promise<ResponseForOperation<"ship.toggleShield">> {
		return this.sendRequest("ship.toggleShield", { shipId });
	}

	public async ventShip(shipId: string): Promise<ResponseForOperation<"ship.vent">> {
		return this.sendRequest("ship.vent", { shipId });
	}

	public async getShipStatus(shipId: string): Promise<ResponseForOperation<"ship.getStatus">> {
		return this.sendRequest("ship.getStatus", { shipId });
	}

	private generateRequestId(): string {
		return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	// 现有的连接管理方法
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
					this.cleanupPendingRequests();
					this.attemptReconnect(url);
				};
			} catch (error) {
				store.dispatch(setConnecting(false));
				reject(error);
			}
		});
	}

	private cleanupPendingRequests(): void {
		const error = new Error("WebSocket disconnected");
		for (const [, pending] of this.pendingRequests.entries()) {
			clearTimeout(pending.timeout);
			pending.reject(error);
		}
		this.pendingRequests.clear();
	}

	public disconnect(): void {
		if (this.ws) {
			this.ws.close(1000, "Client disconnected");
			this.ws = null;
		}
		this.stopPingInterval();
		this.cleanupPendingRequests();
		store.dispatch(setConnected(false));
		store.dispatch(setPlayerId(null));
		store.dispatch(setRoomId(null));
	}

	// 向后兼容的发送方法
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
		_type: "player" | "system" | "combat" = "player",
	): void {
		void _type;
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.CHAT_MESSAGE,
			payload: {
				content,
				senderId,
				senderName,
				timestamp: Date.now(),
			},
		};
		this.send(message);
	}

	public sendDrawingElement(playerId: string, element: DrawingElementPayload): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.DRAWING_ADD,
			payload: {
				playerId,
				element,
			},
		};
		this.send(message);
	}

	public sendDrawingClear(playerId: string): void {
		const message: WSMessage = {
			type: WS_MESSAGE_TYPES.DRAWING_CLEAR,
			payload: { playerId },
		};
		this.send(message);
	}

	// 事件处理器管理
	public on<T extends WSMessageType>(type: T, handler: (payload: WSMessagePayloadMap[T]) => void): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, []);
		}
		this.messageHandlers.get(type)!.push(handler as (payload: unknown) => void);
	}

	public off<T extends WSMessageType>(type: T, handler?: (payload: WSMessagePayloadMap[T]) => void): void {
		const handlers = this.messageHandlers.get(type);
		if (!handlers) return;

		if (!handler) {
			this.messageHandlers.delete(type);
			return;
		}

		const index = handlers.indexOf(handler as (payload: unknown) => void);
		if (index > -1) {
			handlers.splice(index, 1);
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
				const message: PingMessage = {
					type: WS_MESSAGE_TYPES.PING,
					payload: { timestamp: Date.now() },
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
