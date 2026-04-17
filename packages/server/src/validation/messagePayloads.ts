/**
 * Payload 验证器
 *
 * 从 commands/types.ts 导入 Payload 类型
 */

import type {
	AdvanceMovePhasePayload,
	AssignShipPayload,
	ClearOverloadPayload,
	CreateObjectPayload,
	FireWeaponPayload,
	MoveTokenPayload,
	NetPingPayload,
	SetArmorPayload,
	ToggleReadyPayload,
	ToggleShieldPayload,
	VentFluxPayload,
} from "../commands/types.js";
import { MovePhase, Faction } from "@vt/data";
import type { FactionValue } from "@vt/data";

const MOVE_PHASES = Object.values(MovePhase);
type FactionLiteral = Exclude<CreateObjectPayload["faction"], undefined>;
const FACTIONS = new Set<FactionLiteral>(Object.values(Faction));

type MovePhaseLiteral = (typeof MOVE_PHASES)[number];

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === "object" && value !== null;

const asString = (value: unknown): string | null =>
	typeof value === "string" && value.length > 0 ? value : null;

const asBoolean = (value: unknown): boolean | null =>
	typeof value === "boolean" ? value : null;

const asFiniteNumber = (value: unknown): number | null =>
	typeof value === "number" && Number.isFinite(value) ? value : null;

const asInteger = (value: unknown): number | null =>
	typeof value === "number" && Number.isInteger(value) ? value : null;

const asMovePhase = (value: unknown): MovePhaseLiteral | null =>
	typeof value === "string" && MOVE_PHASES.includes(value as MovePhaseLiteral)
		? (value as MovePhaseLiteral)
		: null;

const asFaction = (value: unknown): CreateObjectPayload["faction"] | null =>
	typeof value === "string" && FACTIONS.has(value as FactionLiteral)
		? (value as FactionLiteral)
		: null;

const parseMovementPlan = (
	value: unknown
): MoveTokenPayload["movementPlan"] | null => {
	if (!isRecord(value)) return null;
	const phaseAForward = asFiniteNumber(value.phaseAForward);
	const phaseAStrafe = asFiniteNumber(value.phaseAStrafe);
	const turnAngle = asFiniteNumber(value.turnAngle);
	const phaseCForward = asFiniteNumber(value.phaseCForward);
	const phaseCStrafe = asFiniteNumber(value.phaseCStrafe);

	if (
		phaseAForward === null ||
		phaseAStrafe === null ||
		turnAngle === null ||
		phaseCForward === null ||
		phaseCStrafe === null
	) {
		return null;
	}

	return {
		phaseAForward,
		phaseAStrafe,
		turnAngle,
		phaseCForward,
		phaseCStrafe,
	};
};

const parseMessage = <T>(
	payload: unknown,
	parser: (value: unknown) => T | null,
	errorMessage: string
): T => {
	try {
		const parsed = parser(payload);
		if (!parsed) throw new Error(errorMessage);
		return parsed;
	} catch (error) {
		console.error(`[Validation Error] ${errorMessage}:`, error, "Payload:", payload);
		throw error;
	}
};

export const parseMoveTokenPayload = (payload: unknown): MoveTokenPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const shipId = asString(value.shipId);
			const x = asFiniteNumber(value.x);
			const y = asFiniteNumber(value.y);
			const heading = asFiniteNumber(value.heading);
			const isIncremental =
				value.isIncremental === undefined
					? undefined
					: asBoolean(value.isIncremental);

			// 如果不是增量移动，则 x, y, heading 必须存在
			if (!shipId) return null;
			if (!isIncremental && (x === null || y === null || heading === null)) {
				return null;
			}

			const movementPlan =
				value.movementPlan === undefined
					? undefined
					: parseMovementPlan(value.movementPlan);
			if (value.movementPlan !== undefined && !movementPlan) return null;

			const phase =
				value.phase === undefined ? undefined : asMovePhase(value.phase);
			if (value.phase !== undefined && !phase) return null;

			if (value.isIncremental !== undefined && isIncremental === null) return null;

			const result: MoveTokenPayload = {
				shipId,
				x: x ?? 0,
				y: y ?? 0,
				heading: heading ?? 0,
			};
			if (movementPlan !== undefined && movementPlan !== null) {
				result.movementPlan = movementPlan;
			}
			if (phase !== undefined && phase !== null) result.phase = phase;
			if (isIncremental !== undefined && isIncremental !== null) {
				result.isIncremental = isIncremental;
			}
			return result;
		},
		"移动命令格式错误"
	);

export const parseToggleShieldPayload = (payload: unknown): ToggleShieldPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const shipId = asString(value.shipId);
			const isActive = asBoolean(value.isActive);
			if (!shipId || isActive === null) return null;

			const orientation =
				value.orientation === undefined
					? undefined
					: asFiniteNumber(value.orientation);
			if (value.orientation !== undefined && orientation === null) return null;

			const result: ToggleShieldPayload = { shipId, isActive };
			if (orientation !== undefined && orientation !== null) {
				result.orientation = orientation;
			}
			return result;
		},
		"护盾命令格式错误"
	);

export const parseFireWeaponPayload = (payload: unknown): FireWeaponPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const attackerId = asString(value.attackerId);
			const weaponId = asString(value.weaponId);
			const targetId = asString(value.targetId);
			if (!attackerId || !weaponId || !targetId) return null;
			return { attackerId, weaponId, targetId };
		},
		"开火命令格式错误"
	);

export const parseShipIdPayload = (
	payload: unknown,
	errorMessage: string
): VentFluxPayload | ClearOverloadPayload | AdvanceMovePhasePayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const shipId = asString(value.shipId);
			if (!shipId) return null;
			return { shipId };
		},
		errorMessage
	);

export const parseAssignShipPayload = (payload: unknown): AssignShipPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const shipId = asString(value.shipId);
			const targetSessionId = asString(value.targetSessionId);
			if (!shipId || !targetSessionId) return null;
			return { shipId, targetSessionId };
		},
		"舰船分配命令格式错误"
	);

export const parseToggleReadyPayload = (payload: unknown): ToggleReadyPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const isReady = asBoolean(value.isReady);
			if (isReady === null) return null;
			return { isReady };
		},
		"准备状态命令格式错误"
	);

export const parseCreateObjectPayload = (payload: unknown): CreateObjectPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const type = value.type;
			if (type !== "ship" && type !== "station" && type !== "asteroid") return null;
			const x = asFiniteNumber(value.x);
			const y = asFiniteNumber(value.y);
			if (x === null || y === null) return null;

			const heading =
				value.heading === undefined ? undefined : asFiniteNumber(value.heading);
			if (value.heading !== undefined && heading === null) return null;

			const hullId = value.hullId === undefined ? undefined : asString(value.hullId);
			if (value.hullId !== undefined && !hullId) return null;

			const ownerId =
				value.ownerId === undefined ? undefined : asString(value.ownerId);
			if (value.ownerId !== undefined && !ownerId) return null;

			const name = value.name === undefined ? undefined : asString(value.name);
			if (value.name !== undefined && !name) return null;

			const faction =
				value.faction === undefined ? undefined : asFaction(value.faction);
			if (value.faction !== undefined && !faction) return null;

			const result: CreateObjectPayload = { type, x, y };
			if (faction !== undefined && faction !== null) result.faction = faction;
			if (heading !== undefined && heading !== null) result.heading = heading;
			if (hullId !== undefined && hullId !== null) result.hullId = hullId;
			if (ownerId !== undefined && ownerId !== null) result.ownerId = ownerId;
			if (name !== undefined && name !== null) result.name = name;
			return result;
		},
		"创建对象命令格式错误"
	);

export const parseSetArmorPayload = (payload: unknown): SetArmorPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const shipId = asString(value.shipId);
			const quadrant = asInteger(value.quadrant);
			const armorValue = asFiniteNumber(value.value);
			if (!shipId || quadrant === null || quadrant < 0 || quadrant > 5 || armorValue === null) return null;
			return { shipId, quadrant, value: armorValue };
		},
		"护甲设置命令格式错误"
	);

export const parseNetPingPayload = (payload: unknown): NetPingPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const seq = asInteger(value.seq);
			const clientSentAt = asFiniteNumber(value.clientSentAt);
			if (seq === null || seq < 0 || clientSentAt === null) return null;
			if (clientSentAt > Date.now() + 5_000) return null;
			return { seq, clientSentAt };
		},
		"网络心跳命令格式错误"
	);

export const parseUpdateProfilePayload = (
	payload: unknown
): { nickname?: string; avatar?: string } =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const nickname =
				value.nickname === undefined ? undefined : String(value.nickname);
			
			// 仅允许 avatar 字段，且内容必须是 Base64 (以 data:image/ 开头)
			const avatar = value.avatar === undefined ? undefined : String(value.avatar);

			if (avatar && avatar.length > 250000) {
				throw new Error("头像图片数据过大");
			}

			// 严格检查 Base64 前缀，不允许 URL 或其他格式。
			// 如果不是 Base64 且不为 undefined，则强制设为空字符串，确保 Schema 中不存脏数据。
			const isBase64 = avatar && avatar.startsWith("data:image/");
			const finalAvatar = isBase64 ? avatar : (avatar === undefined ? undefined : "");

			return { nickname, avatar: finalAvatar };
		},
		"玩家资料更新命令格式错误"
	);

export const parseKickPlayerPayload = (
	payload: unknown
): { playerId: string } =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const playerId = asString(value.playerId);
			if (!playerId) return null;
			return { playerId };
		},
		"踢人命令格式错误"
	);

export const parseTransferOwnerPayload = (
	payload: unknown
): { targetSessionId: string } =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const targetSessionId = asString(value.targetSessionId);
			if (!targetSessionId) return null;
			return { targetSessionId };
		},
		"房主转移命令格式错误"
	);