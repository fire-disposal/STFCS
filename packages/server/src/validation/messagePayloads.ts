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
	CustomizeShipPayload,
	AddWeaponMountPayload,
	RemoveWeaponMountPayload,
	UpdateWeaponMountPayload,
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

// ==================== 舰船自定义 Payload 解析 ====================

/**
 * 解析舰船完整自定义 Payload
 *
 * 所有字段可选，仅验证存在的字段
 */
export const parseCustomizeShipPayload = (payload: unknown): CustomizeShipPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const shipId = asString(value.shipId);
			if (!shipId) return null;

			// 基本信息字段（可选）
			const name = value.name === undefined ? undefined : asString(value.name);
			const hullType = value.hullType === undefined ? undefined : asString(value.hullType);
			const width = value.width === undefined ? undefined : asFiniteNumber(value.width);
			const length = value.length === undefined ? undefined : asFiniteNumber(value.length);

			// 生存属性字段（可选）
			const hullPointsMax = value.hullPointsMax === undefined ? undefined : asFiniteNumber(value.hullPointsMax);
			const hullPointsCurrent = value.hullPointsCurrent === undefined ? undefined : asFiniteNumber(value.hullPointsCurrent);
			const armorMaxPerQuadrant = value.armorMaxPerQuadrant === undefined ? undefined : asFiniteNumber(value.armorMaxPerQuadrant);
			const armorMinReductionRatio = value.armorMinReductionRatio === undefined ? undefined : asFiniteNumber(value.armorMinReductionRatio);
			const armorMaxReductionRatio = value.armorMaxReductionRatio === undefined ? undefined : asFiniteNumber(value.armorMaxReductionRatio);

			// 护甲象限（可选）
			let armorQuadrants: [number, number, number, number, number, number] | undefined = undefined;
			if (value.armorQuadrants !== undefined) {
				if (!Array.isArray(value.armorQuadrants) || value.armorQuadrants.length !== 6) {
					return null;
				}
				const parsed = value.armorQuadrants.map((v: unknown) => asFiniteNumber(v));
				if (parsed.some((v) => v === null)) return null;
				armorQuadrants = parsed as [number, number, number, number, number, number];
			}

			// 辐能系统字段（可选）
			const fluxCapacityMax = value.fluxCapacityMax === undefined ? undefined : asFiniteNumber(value.fluxCapacityMax);
			const fluxDissipation = value.fluxDissipation === undefined ? undefined : asFiniteNumber(value.fluxDissipation);
			const fluxSoftCurrent = value.fluxSoftCurrent === undefined ? undefined : asFiniteNumber(value.fluxSoftCurrent);
			const fluxHardCurrent = value.fluxHardCurrent === undefined ? undefined : asFiniteNumber(value.fluxHardCurrent);

			// 护盾系统字段（可选）
			const shieldType = value.shieldType === undefined ? undefined : asString(value.shieldType);
			const shieldArc = value.shieldArc === undefined ? undefined : asFiniteNumber(value.shieldArc);
			const shieldEfficiency = value.shieldEfficiency === undefined ? undefined : asFiniteNumber(value.shieldEfficiency);
			const shieldRadius = value.shieldRadius === undefined ? undefined : asFiniteNumber(value.shieldRadius);
			const shieldUpCost = value.shieldUpCost === undefined ? undefined : asFiniteNumber(value.shieldUpCost);

			// 机动属性字段（可选）
			const maxSpeed = value.maxSpeed === undefined ? undefined : asFiniteNumber(value.maxSpeed);
			const maxTurnRate = value.maxTurnRate === undefined ? undefined : asFiniteNumber(value.maxTurnRate);

			// 其他字段（可选）
			const opCapacity = value.opCapacity === undefined ? undefined : asFiniteNumber(value.opCapacity);
			const rangeModifier = value.rangeModifier === undefined ? undefined : asFiniteNumber(value.rangeModifier);

			// 构建结果
			const result: CustomizeShipPayload = { shipId };
			if (name !== undefined && name !== null) result.name = name;
			if (hullType !== undefined && hullType !== null) result.hullType = hullType;
			if (width !== undefined && width !== null) result.width = width;
			if (length !== undefined && length !== null) result.length = length;
			if (hullPointsMax !== undefined && hullPointsMax !== null) result.hullPointsMax = hullPointsMax;
			if (hullPointsCurrent !== undefined && hullPointsCurrent !== null) result.hullPointsCurrent = hullPointsCurrent;
			if (armorMaxPerQuadrant !== undefined && armorMaxPerQuadrant !== null) result.armorMaxPerQuadrant = armorMaxPerQuadrant;
			if (armorQuadrants !== undefined) result.armorQuadrants = armorQuadrants;
			if (armorMinReductionRatio !== undefined && armorMinReductionRatio !== null) result.armorMinReductionRatio = armorMinReductionRatio;
			if (armorMaxReductionRatio !== undefined && armorMaxReductionRatio !== null) result.armorMaxReductionRatio = armorMaxReductionRatio;
			if (fluxCapacityMax !== undefined && fluxCapacityMax !== null) result.fluxCapacityMax = fluxCapacityMax;
			if (fluxDissipation !== undefined && fluxDissipation !== null) result.fluxDissipation = fluxDissipation;
			if (fluxSoftCurrent !== undefined && fluxSoftCurrent !== null) result.fluxSoftCurrent = fluxSoftCurrent;
			if (fluxHardCurrent !== undefined && fluxHardCurrent !== null) result.fluxHardCurrent = fluxHardCurrent;
			if (shieldType !== undefined && shieldType !== null) result.shieldType = shieldType;
			if (shieldArc !== undefined && shieldArc !== null) result.shieldArc = shieldArc;
			if (shieldEfficiency !== undefined && shieldEfficiency !== null) result.shieldEfficiency = shieldEfficiency;
			if (shieldRadius !== undefined && shieldRadius !== null) result.shieldRadius = shieldRadius;
			if (shieldUpCost !== undefined && shieldUpCost !== null) result.shieldUpCost = shieldUpCost;
			if (maxSpeed !== undefined && maxSpeed !== null) result.maxSpeed = maxSpeed;
			if (maxTurnRate !== undefined && maxTurnRate !== null) result.maxTurnRate = maxTurnRate;
			if (opCapacity !== undefined && opCapacity !== null) result.opCapacity = opCapacity;
			if (rangeModifier !== undefined && rangeModifier !== null) result.rangeModifier = rangeModifier;

			// 武器挂点（可选，复杂对象）
			if (value.weaponMounts !== undefined) {
				if (!Array.isArray(value.weaponMounts)) return null;
				// 简化处理：信任数组内容格式
				result.weaponMounts = value.weaponMounts as any;
			}

			return result;
		},
		"舰船自定义命令格式错误"
	);

/**
 * 解析添加武器挂点 Payload
 */
export const parseAddWeaponMountPayload = (payload: unknown): AddWeaponMountPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const shipId = asString(value.shipId);
			if (!shipId) return null;
			if (!isRecord(value.mount)) return null;

			// 简化处理：信任 mount 对象格式
			return { shipId, mount: value.mount as any };
		},
		"添加武器挂点命令格式错误"
	);

/**
 * 解析删除武器挂点 Payload
 */
export const parseRemoveWeaponMountPayload = (payload: unknown): RemoveWeaponMountPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const shipId = asString(value.shipId);
			const mountId = asString(value.mountId);
			if (!shipId || !mountId) return null;
			return { shipId, mountId };
		},
		"删除武器挂点命令格式错误"
	);

/**
 * 解析更新武器挂点 Payload
 */
export const parseUpdateWeaponMountPayload = (payload: unknown): UpdateWeaponMountPayload =>
	parseMessage(
		payload,
		(value) => {
			if (!isRecord(value)) return null;
			const shipId = asString(value.shipId);
			const mountId = asString(value.mountId);
			if (!shipId || !mountId) return null;
			if (!isRecord(value.updates)) return null;

			return { shipId, mountId, updates: value.updates as any };
		},
		"更新武器挂点命令格式错误"
	);