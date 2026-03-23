import { store } from "@/store";
import { removeOtherPlayerCamera } from "@/store/slices/mapSlice";
import { updateOtherPlayerCamera } from "@/store/slices/mapSlice";
import { beginTokenDrag, endTokenDrag, updateTokenDrag } from "@/store/slices/selectionSlice";
import {
	setConnected,
	setConnecting,
	setPlayerId,
	setRoomId,
	updatePing,
} from "@/store/slices/uiSlice";
import { updateToken } from "@/store/slices/mapSlice";
import type { PlayerCamera, ShipMovement } from "@vt/shared/types";
import type {
	PlayerJoinedMessage,
	RequestMessage,
	RequestOperation,
	RequestPayload,
	ResponseForOperation,
	ResponseMessage,
	ShipMovedMessage,
	WSMessage,
	WSMessagePayloadMap,
	WSMessageType,
} from "@vt/shared/ws";
import type { DrawingElement } from "@vt/shared/ws";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";

// 使用共享的 WSMessagePayloadMap，无需重复定义
export type { WSMessage, WSMessageType, WSMessagePayloadMap };

// 便捷类型别名
export type PlayerJoinedPayload = WSMessagePayloadMap[typeof WS_MESSAGE_TYPES.PLAYER_JOINED];
export type ShipMovedPayload = WSMessagePayloadMap[typeof WS_MESSAGE_TYPES.SHIP_MOVED];
export type ChatMessagePayloadType = WSMessagePayloadMap[typeof WS_MESSAGE_TYPES.CHAT_MESSAGE];
export type RoomUpdatePayload = WSMessagePayloadMap[typeof WS_MESSAGE_TYPES.ROOM_UPDATE];

interface PendingRequest {
	resolve: (data: unknown) => void;
	reject: (error: Error) => void;
	timeout: NodeJS.Timeout;
	operation: RequestOperation;
}

type MessageHandler<T extends WSMessageType> = (payload: WSMessagePayloadMap[T]) => void;

export class WebSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private pingInterval: NodeJS.Timeout | null = null;
	private messageHandlers = new Map<WSMessageType, Set<(...args: unknown[]) => void>>();
	private pendingRequests = new Map<string, PendingRequest>();
	private requestTimeout = 10000;

	constructor() {
		this.setupMessageHandlers();
	}

	private setupMessageHandlers(): void {
		// 使用新架构的事件总线集成处理领域事件
		// 手动处理器保留用于特定业务逻辑
		this.on(WS_MESSAGE_TYPES.PLAYER_JOINED, (payload) => {
			console.log("Player joined:", payload);
		});

		this.on(WS_MESSAGE_TYPES.PLAYER_LEFT, (payload) => {
			console.log("Player left:", payload.playerId);
			store.dispatch(removeOtherPlayerCamera(payload.playerId));
		});

		this.on(WS_MESSAGE_TYPES.SHIP_MOVED, (payload) => {
			console.log("Ship moved:", payload);
		});

		this.on(WS_MESSAGE_TYPES.TOKEN_MOVED, (payload) => {
			store.dispatch(
				updateToken({
					id: payload.tokenId,
					updates: {
						position: payload.newPosition,
						heading: payload.newHeading,
					},
				})
			);
		});

		this.on(WS_MESSAGE_TYPES.CHAT_MESSAGE, (payload) => {
			console.log("Chat message:", payload);
		});

		this.on(WS_MESSAGE_TYPES.PONG, () => {
			store.dispatch(updatePing());
		});

		this.on(WS_MESSAGE_TYPES.ROOM_UPDATE, (payload) => {
			console.log("Room updated:", payload);
		});

		this.on(WS_MESSAGE_TYPES.CAMERA_UPDATED, (payload: PlayerCamera) => {
			store.dispatch(updateOtherPlayerCamera(payload));
		});

		// Token 拖拽处理器
		this.on(WS_MESSAGE_TYPES.TOKEN_DRAG_START, (payload) => {
			store.dispatch(
				beginTokenDrag({
					tokenId: payload.tokenId,
					playerId: payload.playerId,
					playerName: payload.playerName,
					position: payload.position,
					heading: payload.heading,
					timestamp: payload.timestamp,
				})
			);
		});

		this.on(WS_MESSAGE_TYPES.TOKEN_DRAGGING, (payload) => {
			store.dispatch(
				updateTokenDrag({
					tokenId: payload.tokenId,
					playerId: payload.playerId,
					playerName: payload.playerName,
					position: payload.position,
					heading: payload.heading,
					timestamp: payload.timestamp,
				})
			);
		});

		this.on(WS_MESSAGE_TYPES.TOKEN_DRAG_END, (payload) => {
			store.dispatch(
				endTokenDrag({
					tokenId: payload.tokenId,
					playerId: payload.playerId,
					finalPosition: payload.finalPosition,
					finalHeading: payload.finalHeading,
					committed: payload.committed,
					timestamp: payload.timestamp,
				})
			);
		});

		// 响应处理器
		this.on(WS_MESSAGE_TYPES.RESPONSE, (payload) => {
			this.handleResponse(payload);
		});
	}

	private handleResponse(responsePayload: ResponseMessage["payload"]): void {
		const { requestId, ...response } = responsePayload;
		const pending = this.pendingRequests.get(requestId);

		if (!pending) {
			console.warn(`Received response for unknown request ID: ${requestId}`);
			return;
		}

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
				resolve: (data: unknown) => resolve(data as any),
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
		return this.sendRequest("player.join", { id: playerId, name: playerName, roomId });
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
		return this.sendRequest("ship.move", { shipId, phase, type, distance, angle });
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

	public async getMapSnapshot(roomId?: string): Promise<ResponseForOperation<"map.snapshot.get">> {
		return this.sendRequest("map.snapshot.get", { roomId });
	}

	public async saveMapSnapshot(
		snapshot: unknown,
		roomId?: string
	): Promise<ResponseForOperation<"map.snapshot.save">> {
		return this.sendRequest("map.snapshot.save", { roomId, snapshot });
	}

	public async moveMapToken(
		tokenId: string,
		position: { x: number; y: number },
		heading: number,
		roomId?: string
	): Promise<ResponseForOperation<"map.token.move">> {
		return this.sendRequest("map.token.move", { roomId, tokenId, position, heading });
	}

	public async getRoomState(roomId?: string): Promise<ResponseForOperation<"room.state.get">> {
		return this.sendRequest("room.state.get", { roomId });
	}

	private generateRequestId(): string {
		return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	// 连接管理
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

	public send(message: WSMessage): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			console.warn("WebSocket is not connected");
		}
	}

	public sendPlayerJoined(playerId: string, playerName: string, roomId: string): void {
		void roomId;
		const message: PlayerJoinedMessage = {
			type: WS_MESSAGE_TYPES.PLAYER_JOINED,
			payload: {
				id: playerId,
				name: playerName,
				joinedAt: Date.now(),
				isActive: true,
				isDMMode: false,
			},
		};
		this.send(message);
	}

	public sendShipMovement(movement: ShipMovement): void {
		const message: ShipMovedMessage = {
			type: WS_MESSAGE_TYPES.SHIP_MOVED,
			payload: movement,
		};
		this.send(message);
	}

	public sendChatMessage(content: string, senderId: string, senderName: string): void {
		this.send({
			type: WS_MESSAGE_TYPES.CHAT_MESSAGE,
			payload: {
				content,
				senderId,
				senderName,
				timestamp: Date.now(),
			},
		});
	}

	public sendDrawingElement(playerId: string, element: DrawingElement): void {
		this.send({
			type: WS_MESSAGE_TYPES.DRAWING_ADD,
			payload: { playerId, element },
		});
	}

	public sendDrawingClear(playerId: string): void {
		this.send({
			type: WS_MESSAGE_TYPES.DRAWING_CLEAR,
			payload: { playerId },
		});
	}

	// Token 拖拽相关方法
	public sendTokenDragStart(
		tokenId: string,
		playerId: string,
		playerName: string,
		position: { x: number; y: number },
		heading: number
	): void {
		this.send({
			type: WS_MESSAGE_TYPES.TOKEN_DRAG_START,
			payload: {
				tokenId,
				playerId,
				playerName,
				position,
				heading,
				timestamp: Date.now(),
			},
		});
	}

	public sendTokenDragging(
		tokenId: string,
		playerId: string,
		playerName: string,
		position: { x: number; y: number },
		heading: number
	): void {
		this.send({
			type: WS_MESSAGE_TYPES.TOKEN_DRAGGING,
			payload: {
				tokenId,
				playerId,
				playerName,
				position,
				heading,
				timestamp: Date.now(),
				isDragging: true,
			},
		});
	}

	public sendTokenDragEnd(
		tokenId: string,
		playerId: string,
		finalPosition: { x: number; y: number },
		finalHeading: number,
		committed: boolean
	): void {
		this.send({
			type: WS_MESSAGE_TYPES.TOKEN_DRAG_END,
			payload: {
				tokenId,
				playerId,
				finalPosition,
				finalHeading,
				timestamp: Date.now(),
				committed,
			},
		});
	}

	// 事件处理器管理 - 使用类型安全的泛型
	public on<T extends WSMessageType>(type: T, handler: MessageHandler<T>): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, new Set());
		}
		this.messageHandlers.get(type)!.add(handler as (...args: unknown[]) => void);
	}

	public off<T extends WSMessageType>(type: T, handler?: MessageHandler<T>): void {
		const handlers = this.messageHandlers.get(type);
		if (!handlers) return;

		if (!handler) {
			this.messageHandlers.delete(type);
			return;
		}

		handlers.delete(handler as (...args: unknown[]) => void);
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
				this.send({
					type: WS_MESSAGE_TYPES.PING,
					payload: { timestamp: Date.now() },
				});
			}
		}, 30000);
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
			console.log(
				`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
			);
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
