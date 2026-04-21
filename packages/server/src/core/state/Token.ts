/**
 * Token状态 - 基于 @vt/data 权威设计
 *
 * 后端只管理核心游戏状态，显示属性由前端本地管理
 * Token 本质上是 TokenJSON 的运行时包装
 */

import type {
	TokenJSON,
	TokenSpec,
	TokenRuntime,
	Faction,
	FluxState,
	MovementState,
	Point,
} from "@vt/data";
import {
	Faction as FactionEnum,
	FluxState as FluxStateEnum,
	MovementPhase as MovementPhaseEnum,
} from "@vt/data";

/**
 * Token类型枚举（后端特有，扩展schema）
 */
export type TokenType = "SHIP" | "STATION" | "ASTEROID" | "PROJECTILE" | "EFFECT";

/**
 * Token运行时状态（后端特有，用于非Ship类型的Token）
 */
export interface TokenRuntimeBase {
	position: Point;
	heading: number;
	faction?: Faction;
	ownerId?: string;
}

/**
 * CombatToken - 直接使用TokenJSON作为数据载体
 *
 * 后端只维护核心游戏状态：
 * - TokenJSON 包含 spec + runtime + metadata
 * - runtime 中的 position/heading/hull/armor/flux 等是游戏逻辑状态
 * - 显示状态(selected/visible等)由前端本地管理
 */
export interface CombatToken {
	id: string;
	type: "SHIP";
	tokenJson: TokenJSON;
}

/**
 * 其他类型Token（地形、效果等）
 */
export interface OtherToken {
	id: string;
	type: "STATION" | "ASTEROID" | "PROJECTILE" | "EFFECT";
	runtime: TokenRuntimeBase;
	dataRef: string;
}

/**
 * Token联合类型
 */
export type Token = CombatToken | OtherToken;

/**
 * 派生状态（用于快速访问，不从schema推导）
 *
 * 这些是计算值，用于简化前端显示逻辑
 */
export interface DerivedTokenState {
	fluxState: FluxState;
	fluxPercentage: number;
	hullPercentage: number;
	armorPercentages: number[];
	phaseAAvailable: number;
	phaseCAvailable: number;
	turnAngleAvailable: number;
	weaponsReady: number;
	weaponsTotal: number;
}

/**
 * 创建CombatToken
 */
export function createCombatToken(
	id: string,
	tokenJson: TokenJSON,
	position: Point,
	heading: number = 0,
	faction?: Faction,
	ownerId?: string
): CombatToken {
	const spec = tokenJson.token;

	const runtime: TokenRuntime = {
		position,
		heading,
		hull: spec.maxHitPoints,
		armor: Array(6).fill(spec.armorMaxPerQuadrant) as [number, number, number, number, number, number],
		fluxSoft: 0,
		fluxHard: 0,
		overloaded: false,
		overloadTime: 0,
		destroyed: false,
		movement: {
			currentPhase: MovementPhaseEnum.A,
			phaseAUsed: 0,
			turnAngleUsed: 0,
			phaseCUsed: 0,
			hasMoved: false,
		},
		hasFired: false,
		faction: faction ?? FactionEnum.NEUTRAL,
		...(ownerId !== undefined ? { ownerId } : {}),
		...(spec.shield ? { shield: { active: false, value: spec.shield.radius } } : {}),
	};

	const fullTokenJson: TokenJSON = {
		...tokenJson,
		runtime,
	};

	return {
		id,
		type: "SHIP",
		tokenJson: fullTokenJson,
	};
}

/**
 * 计算派生状态
 */
export function calculateDerivedState(tokenJson: TokenJSON): DerivedTokenState {
	const spec = tokenJson.token;
	const runtime = tokenJson.runtime;
	if (!runtime) {
		return createDefaultDerivedState(spec);
	}

	const totalFlux = (runtime.fluxSoft ?? 0) + (runtime.fluxHard ?? 0);
	const fluxCapacity = spec.fluxCapacity ?? 100;
	const fluxRatio = totalFlux / fluxCapacity;

	let fluxState: FluxState = FluxStateEnum.NORMAL;
	if (runtime.overloaded) {
		fluxState = FluxStateEnum.OVERLOADED;
	} else if (runtime.venting) {
		fluxState = FluxStateEnum.VENTING;
	} else if (fluxRatio >= 0.7) {
		fluxState = FluxStateEnum.HIGH;
	}

	const weapons = runtime.weapons ?? [];
	const weaponsReady = weapons.filter((w: { state: string }) => w.state === "READY").length;
	const weaponsTotal = weapons.length;

	const movement = runtime.movement;
	const phaseAUsed = movement?.phaseAUsed ?? 0;
	const phaseCUsed = movement?.phaseCUsed ?? 0;
	const turnAngleUsed = movement?.turnAngleUsed ?? 0;

	return {
		fluxState,
		fluxPercentage: (totalFlux / fluxCapacity) * 100,
		hullPercentage: (runtime.hull / spec.maxHitPoints) * 100,
		armorPercentages: runtime.armor.map((a: number) => (a / spec.armorMaxPerQuadrant) * 100),
		phaseAAvailable: spec.maxSpeed - phaseAUsed,
		phaseCAvailable: spec.maxSpeed - phaseCUsed,
		turnAngleAvailable: spec.maxTurnRate - turnAngleUsed,
		weaponsReady,
		weaponsTotal,
	};
}

function createDefaultDerivedState(spec: TokenSpec): DerivedTokenState {
	return {
		fluxState: FluxStateEnum.NORMAL,
		fluxPercentage: 0,
		hullPercentage: 100,
		armorPercentages: Array(6).fill(100),
		phaseAAvailable: spec.maxSpeed,
		phaseCAvailable: spec.maxSpeed,
		turnAngleAvailable: spec.maxTurnRate,
		weaponsReady: 0,
		weaponsTotal: 0,
	};
}

/**
 * 更新CombatToken的runtime
 */
export function updateTokenRuntime(token: CombatToken, runtimeUpdates: Partial<TokenRuntime>): CombatToken {
	const currentRuntime = token.tokenJson.runtime;
	if (!currentRuntime) {
		return {
			...token,
			tokenJson: {
				...token.tokenJson,
				runtime: runtimeUpdates as TokenRuntime,
			},
		};
	}

	const newRuntime = {
		...currentRuntime,
		...runtimeUpdates,
	};

	return {
		...token,
		tokenJson: {
			...token.tokenJson,
			runtime: newRuntime,
		},
	};
}

/**
 * 应用伤害到CombatToken
 */
export function applyDamage(
	token: CombatToken,
	hullDamage: number,
	armorDamage: number,
	armorQuadrant: number,
	fluxHardGenerated: number,
	shieldHit: boolean
): CombatToken {
	const runtime = token.tokenJson.runtime;
	if (!runtime) return token;

	const newHull = Math.max(0, runtime.hull - hullDamage);
	const newArmor = [...runtime.armor] as [number, number, number, number, number, number];
	if (armorQuadrant >= 0 && armorQuadrant < 6) {
		newArmor[armorQuadrant] = Math.max(0, (newArmor[armorQuadrant] ?? 0) - armorDamage);
	}

	const newFluxHard = shieldHit
		? (runtime.fluxHard ?? 0) + fluxHardGenerated
		: runtime.fluxHard;

	const spec = token.tokenJson.token;
	const totalFlux = (runtime.fluxSoft ?? 0) + (newFluxHard ?? 0);
	const fluxCapacity = spec.fluxCapacity ?? 100;
	const newOverloaded = totalFlux > fluxCapacity && !runtime.overloaded;

	return updateTokenRuntime(token, {
		hull: newHull,
		armor: newArmor,
		fluxHard: newFluxHard,
		overloaded: newOverloaded ? true : runtime.overloaded,
		overloadTime: newOverloaded ? 1 : runtime.overloadTime,
		destroyed: newHull <= 0 ? true : runtime.destroyed,
	});
}

/**
 * 移动CombatToken
 */
export function moveToken(token: CombatToken, newPosition: Point, phase: "A" | "C", distance: number): CombatToken {
	const runtime = token.tokenJson.runtime;
	if (!runtime) return token;

	const movement = runtime.movement ?? {
		currentPhase: MovementPhaseEnum.A,
		phaseAUsed: 0,
		turnAngleUsed: 0,
		phaseCUsed: 0,
		hasMoved: false,
	};

	const newMovement: MovementState = {
		...movement,
		[phase === "A" ? "phaseAUsed" : "phaseCUsed"]: ((phase === "A" ? movement.phaseAUsed : movement.phaseCUsed) ?? 0) + distance,
	};

	return updateTokenRuntime(token, {
		position: newPosition,
		movement: newMovement,
	});
}

/**
 * 旋转CombatToken
 */
export function rotateToken(token: CombatToken, newHeading: number, angleUsed: number): CombatToken {
	const runtime = token.tokenJson.runtime;
	if (!runtime) return token;

	const normalizedHeading = ((newHeading % 360) + 360) % 360;
	const movement = runtime.movement ?? {
		currentPhase: MovementPhaseEnum.A,
		phaseAUsed: 0,
		turnAngleUsed: 0,
		phaseCUsed: 0,
		hasMoved: false,
	};

	return updateTokenRuntime(token, {
		heading: normalizedHeading,
		movement: {
			...movement,
			turnAngleUsed: (movement.turnAngleUsed ?? 0) + angleUsed,
		},
	});
}

/**
 * 推进移动阶段
 */
export function advanceMovementPhase(token: CombatToken): CombatToken {
	const runtime = token.tokenJson.runtime;
	if (!runtime) return token;

	const movement = runtime.movement ?? {
		currentPhase: MovementPhaseEnum.A,
		phaseAUsed: 0,
		turnAngleUsed: 0,
		phaseCUsed: 0,
		hasMoved: false,
	};

	const phaseOrder: ("A" | "B" | "C" | "DONE")[] = ["A", "B", "C", "DONE"];
	const currentIdx = phaseOrder.indexOf(movement.currentPhase ?? MovementPhaseEnum.A);
	const nextPhase = phaseOrder[Math.min(currentIdx + 1, 3)];

	return updateTokenRuntime(token, {
		movement: {
			...movement,
			currentPhase: nextPhase,
			hasMoved: nextPhase === MovementPhaseEnum.DONE,
		},
	});
}

/**
 * Token是否可行动
 */
export function canAct(token: Token): boolean {
	if (token.type !== "SHIP") return false;
	const runtime = token.tokenJson.runtime;
	if (!runtime) return false;
	return !runtime.destroyed && !runtime.overloaded;
}

/**
 * Token是否被摧毁
 */
export function isDestroyed(token: Token): boolean {
	if (token.type !== "SHIP") return false;
	return token.tokenJson.runtime?.destroyed ?? false;
}

/**
 * 获取Token名称
 */
export function getTokenName(token: Token): string {
	if (token.type === "SHIP") {
		return token.tokenJson.metadata.name;
	}
	return `Token_${token.id.substring(0, 8)}`;
}

/**
 * 获取Token位置
 */
export function getTokenPosition(token: Token): Point {
	if (token.type === "SHIP") {
		return token.tokenJson.runtime?.position ?? { x: 0, y: 0 };
	}
	return token.runtime.position;
}

/**
 * 获取Token朝向
 */
export function getTokenHeading(token: Token): number {
	if (token.type === "SHIP") {
		return token.tokenJson.runtime?.heading ?? 0;
	}
	return token.runtime.heading;
}

/**
 * 获取Token阵营
 */
export function getTokenFaction(token: Token): Faction {
	if (token.type === "SHIP") {
		return token.tokenJson.runtime?.faction ?? FactionEnum.NEUTRAL;
	}
	return token.runtime.faction ?? FactionEnum.NEUTRAL;
}

/** @deprecated 使用 CombatToken */
export type ShipToken = CombatToken;
/** @deprecated 使用 DerivedTokenState */
export type DerivedShipState = DerivedTokenState;
/** @deprecated 使用 createCombatToken */
export const createShipToken = createCombatToken;
/** @deprecated 使用 updateTokenRuntime */
export const updateShipRuntime = updateTokenRuntime;
/** @deprecated 使用 moveToken */
export const moveShip = moveToken;
/** @deprecated 使用 rotateToken */
export const rotateShip = rotateToken;