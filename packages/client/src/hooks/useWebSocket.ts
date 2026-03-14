/**
 * WebSocket 连接 Hook
 * 管理 WebSocket 连接状态和消息处理
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { websocketService } from "@/services/websocket";
import type { WSMessageType } from "@vt/shared/ws";

interface UseWebSocketOptions {
	autoConnect?: boolean;
	autoReconnect?: boolean;
	maxReconnectAttempts?: number;
}

export type { UseWebSocketOptions };

interface UseWebSocketReturn {
	isConnected: boolean;
	isConnecting: boolean;
	sendMessage: (payload: unknown) => void;
	addHandler: (handler: (payload: unknown) => void) => void;
	removeHandler: (handler: (payload: unknown) => void) => void;
	connect: () => Promise<void>;
	disconnect: () => void;
}

export type { UseWebSocketReturn };

/**
 * WebSocket Hook
 * @param messageType 要监听的消息类型
 * @param options 配置选项
 */
export function useWebSocket(
	messageType: WSMessageType,
	options: UseWebSocketOptions = {}
): UseWebSocketReturn {
	const { autoConnect = true, autoReconnect = true } = options;
	const handlerRef = useRef<Set<(payload: unknown) => void>>(new Set());
	const isConnectedRef = useRef(false);

	// 连接状态
	const isConnected = websocketService.isConnected();
	isConnectedRef.current = isConnected;

	// 添加消息处理器
	const addHandler = useCallback((handler: (payload: unknown) => void) => {
		handlerRef.current.add(handler);
	}, []);

	// 移除消息处理器
	const removeHandler = useCallback((handler: (payload: unknown) => void) => {
		handlerRef.current.delete(handler);
	}, []);

	// 发送消息
	const sendMessage = useCallback((payload: unknown) => {
		if (websocketService.isConnected()) {
			websocketService.send({
				type: messageType,
				payload,
			} as any);
		} else {
			console.warn("WebSocket is not connected");
		}
	}, [messageType]);

	// 连接
	const connect = useCallback(async () => {
		if (!websocketService.isConnected()) {
			await websocketService.connect("ws://localhost:3001");
		}
	}, []);

	// 断开连接
	const disconnect = useCallback(() => {
		websocketService.disconnect();
	}, []);

	// 注册/注销消息监听器
	useEffect(() => {
		const handler = (payload: unknown) => {
			handlerRef.current.forEach((h) => h(payload));
		};

		websocketService.on(messageType, handler);

		return () => {
			websocketService.off(messageType, handler);
		};
	}, [messageType]);

	// 自动连接
	useEffect(() => {
		if (autoConnect) {
			connect().catch((error) => {
				console.error("Failed to auto-connect:", error);
			});
		}

		return () => {
			if (!autoReconnect) {
				disconnect();
			}
		};
	}, [autoConnect, autoReconnect, connect, disconnect]);

	return {
		isConnected,
		isConnecting: !isConnected && autoConnect,
		sendMessage,
		addHandler,
		removeHandler,
		connect,
		disconnect,
	};
}

/**
 * 简化的 WebSocket 状态 Hook
 * 仅用于获取连接状态
 */
export function useWebSocketStatus() {
	const [isConnected, setIsConnected] = useState(websocketService.isConnected());

	useEffect(() => {
		const checkConnection = () => {
			setIsConnected(websocketService.isConnected());
		};

		// 定期检查连接状态
		const interval = setInterval(checkConnection, 1000);

		return () => {
			clearInterval(interval);
		};
	}, []);

	return { isConnected };
}
