/**
 * Schema 导出
 *
 * 所有 Zod schema 从 core-types.ts 统一导出，此处仅重新导出
 */

export {
  // 基础
  PointSchema,
  PROTOCOL_VERSION,
  // 玩家
  PlayerInfoSchema,
  PlayerGameStateSchema,
  // 舰船
  ArmorQuadrantSchema,
  ArmorStateSchema,
  FluxTypeSchema,
  FluxStateSchema,
  FluxOverloadStateSchema,
  ShieldSpecSchema,
  ShipStatusSchema,
  ShipMovementPhaseSchema,
  ShipMovementTypeSchema,
  ShipMovementSchema,
  // 武器
  WeaponTypeSchema,
  WeaponMountTypeSchema,
  WeaponSpecSchema,
  WeaponMountSchema,
  AttackCommandSchema,
  // 战斗
  ExplosionDataSchema,
  CombatResultSchema,
  // 地图与 Token
  MapConfigSchema,
  TokenTypeSchema,
  UnitTurnStateSchema,
  TokenInfoSchema,
  // 相机
  CameraStateSchema,
  PlayerCameraSchema,
  CameraUpdateCommandSchema,
  CameraConfigSchema,
  // 回合系统
  TurnPhaseSchema,
  TurnUnitSchema,
  TurnOrderSchema,
  TurnStateSchema,
} from '../core-types';
