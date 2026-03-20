/**
 * WebSocket 连接 Hook
 *
 * 简化版：仅用于获取连接状态
 * 所有操作调用请使用 useRoomOperations
 */

import { useEffect, useState } from "react";
import { websocketService } from "@/services/websocket";

interface UseWebSocketStatusReturn {
	isConnected: boolean;
	isConnecting: boolean;
	error: string | null;
}

/**
 * WebSocket 状态 Hook
 * 仅用于获取连接状态
 */
export function useWebSocketStatus(): UseWebSocketStatusReturn {
	const [state, setState] = useState<UseWebSocketStatusReturn>({
		isConnected: websocketService.isConnected(),
		isConnecting: false,
		error: null,
	});

	useEffect(() => {
		// 订阅状态变化
		const unsubscribe = websocketService.onStateChange(() => {
			setState({
				isConnected: websocketService.isConnected(),
				isConnecting: false,
				error: websocketService.connectionState.error,
			});
		});

		// 初始状态
		setState({
			isConnected: websocketService.isConnected(),
			isConnecting: false,
			error: websocketService.connectionState.error,
		});

		return unsubscribe;
	}, []);

	return state;
}

/**
 * 获取 RoomClient 的 Hook
 *
 * @example
 * ```tsx
 * const client = useRoomClient();
 *
 * if (client) {
 *   await client.call('join', 'Alice');
 * }
 * ```
 */
export function useRoomClient() {
	return websocketService.client;
}

export type { UseWebSocketStatusReturn };