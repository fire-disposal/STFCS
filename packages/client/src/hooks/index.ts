/**
 * 自定义 Hooks 导出
 */

export { useCamera } from "./useCamera";
export type { UseCameraReturn } from "./useCamera";

export { useTokenSelection } from "./useTokenSelection";

export { usePixiApp } from "./usePixiApp";
export type { UsePixiAppOptions, UsePixiAppReturn } from "./usePixiApp";

export { useCanvasInteraction } from "./useCanvasInteraction";
export type { UseCanvasInteractionOptions } from "./useCanvasInteraction";

export { useCurrentGameRoom } from "./useCurrentGameRoom";

// Colyseus 响应式状态 Hooks
export {
	useMultiplayerState,
	usePlayers,
	useShips,
	useCurrentPlayer,
	useGamePhase,
	useTurnCount,
	useActiveFaction,
} from "./useMultiplayerState";

// Colyseus 聊天消息 Hooks
export {
	useChatMessages,
	useSystemMessages,
	useSendChatMessage,
	type ChatMessage,
} from "./useChatMessages";
