export {
	toRadians,
	toDegrees,
	distance,
	angleBetween,
	angleDifference,
	normalizeAngle,
	validateThreePhaseMove,
	isMoveValid,
	isTurnValid,
	createShipPolygon,
	checkCollision,
	isPointInArc,
	calculateThreePhaseMove,
	type MovementPlan,
} from "./math/index.js";
export {
	PRESET_SHIPS,
	getShipHullSpec,
	getAvailableShips,
	importShipHullFromJson,
	exportShipHullToJson,
} from "./data/ShipHullSchema.js";
export type { ShipHullSpec } from "./data/ShipHullSchema.js";
export {
	PRESET_WEAPONS,
	getWeaponSpec,
	getAvailableWeapons,
	DAMAGE_MULTIPLIERS,
} from "./data/WeaponSchema.js";

export * from "@vt/contracts";
