/**
 * 共享包主导出文件
 * 为避免类型冲突，使用明确导出而不是通配符导出
 */

// 导出常量
export * from "./constants";

// 导出模式验证
export * from "./schemas";

// 导出核心类型定义
export type {
	// 玩家相关
	PlayerInfo,
	// 舰船相关
	ShipStatus,
	ArmorQuadrant,
	ArmorState,
	FluxState,
	FluxType,
	FluxOverloadState,
	ShieldSpec,
	ShipMovement,
	PlayerGameState,
	// 武器相关
	WeaponType,
	WeaponMountType,
	WeaponSpec,
	WeaponMount,
	// 战斗相关
	ExplosionData,
	AttackCommand,
	CombatResult,
	// 地图与 Token
	MapConfig,
	TokenInfo,
	TokenType,
	UnitTurnState,
	// 相机
	CameraState,
	PlayerCamera,
	CameraUpdateCommand,
	CameraConfig,
	// 回合系统
	TurnPhase,
	TurnUnit,
	TurnOrder,
	TurnState,
	// 结果类型
	Result,
	Success,
	Failure,
	OptionalResult,
} from "./types";

// 导出结果类型工具函数
export { ok, fail } from "./types";

// 导出 WebSocket 类型（权威定义）
export {
	WS_MESSAGE_TYPES,
	type WSMessage,
	type WSMessageType,
	type PlayerJoinedMessage,
	type PlayerLeftMessage,
	type ShipMovedMessage,
	type ShipStatusUpdateMessage,
	type ExplosionMessage,
	type ShieldUpdateMessage,
	type FluxStateMessage,
	type CombatEventMessage,
	type MapInitializedMessage,
	type TokenPlacedMessage,
	type TokenMovedMessage,
	type CameraUpdatedMessage,
	type WeaponFiredMessage,
	type DamageDealtMessage,
	type DrawingAddMessage,
	type DrawingClearMessage,
	type DrawingSyncMessage,
	type ChatMessagePayload,
	type ErrorMessage,
	type PingMessage,
	type PongMessage,
	type RoomUpdateMessage,
	type RoomPlayerSnapshot,
	type IWSServer,
	type IWSClient,
	// DM 模式
	type DMToggleMessage,
	type DMStatusUpdateMessage,
	// 选择系统
	type ObjectSelectedMessage,
	type ObjectDeselectedMessage,
	type SelectionUpdateMessage,
	type TokenDraggingMessage,
	// 回合系统消息
	type TurnOrderInitializedMessage,
	type TurnOrderUpdatedMessage,
	type TurnIndexChangedMessage,
	type UnitStateChangedMessage,
	type RoundIncrementedMessage,
	// 请求响应类型
	type RequestMessage,
	type ResponseMessage,
	type RequestPayload,
	type RequestOperation,
	type ResponseData,
	type ResponseDataUnion,
	type ResponseForOperation,
	type OperationHandler,
	type RequestHandlers,
	// 请求负载类型
	type PlayerJoinRequestPayload,
	type PlayerLeaveRequestPayload,
	type PlayerListRequestPayload,
	type RoomListRequestPayload,
	type RoomCreateRequestPayload,
	type ShipMoveRequestPayload,
	type ShipToggleShieldRequestPayload,
	type ShipVentRequestPayload,
	type ShipGetStatusRequestPayload,
	type DMToggleRequestPayload,
	type CameraUpdateRequestPayload,
	// 响应负载类型
	type PlayerJoinResponsePayload,
	type PlayerLeaveResponsePayload,
	type PlayerListResponsePayload,
	type RoomListResponsePayload,
	type RoomCreateResponsePayload,
	type ShipMoveResponsePayload,
	type ShipToggleShieldResponsePayload,
	type ShipVentResponsePayload,
	type ShipGetStatusResponsePayload,
	type DMToggleResponsePayload,
	type CameraUpdateResponsePayload,
	type SuccessResponse,
	type ErrorResponse,
	type ResponsePayload,
} from "./ws";
