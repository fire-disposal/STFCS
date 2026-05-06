/**
 * Core 模块导出
 */

export * from "./GameSchemas.js"
export * from "./ActionSchemas.js"
export * from "./WsSchemas.js"
export * from "./RpcClient.js"
export * from "./geometry.js"
export * from "./ErrorCodes.js"
export { validatePresets } from "./validatePresets.js"
export type { PresetValidationResult, PresetValidationItem, PresetValidationIssue } from "./validatePresets.js"

// WorldSchemas — 显式导出（GameSchemas 已含 PointSchema，避免歧义）
export {
  WorldNodeTypeSchema,
  WorldNodeStateSchema,
  WorldEdgeTypeSchema,
  TerrainProfileSchema,
  TimelineEventSchema,
  WorldNodeSchema,
  WorldEdgeSchema,
  WorldMapSchema,
  validateWorldMap,
  getReachableNodes,
  canTravel,
  advanceDay,
} from "./WorldSchemas.js"
export type {
  WorldNodeType,
  WorldNodeState,
  WorldEdgeType,
  TerrainProfile,
  TimelineEvent,
  WorldNode,
  WorldEdge,
  WorldMap,
} from "./WorldSchemas.js"
