/**
 * Token状态 - 基于 @vt/data 权威设计
 *
 * CombatToken 直接使用 schema 定义的类型
 * InventoryToken 用于存档管理（无runtime）
 */

import type {
	CombatToken as CombatTokenSchema,
	InventoryToken as InventoryTokenSchema,
	TokenSpec,
	TokenRuntime,
	Faction,
	Point,
	MovementState,
} from "@vt/data";
import {
	Faction as FactionEnum,
	MovementPhase as MovementPhaseEnum,
} from "@vt/data";

export type CombatToken = CombatTokenSchema;
export type InventoryToken = InventoryTokenSchema;

export type TokenType = "SHIP" | "STATION" | "ASTEROID" | "PROJECTILE" | "EFFECT";

export interface OtherToken {
	$id: string;
	type: TokenType;
	runtime: TokenRuntime;
	dataRef: string;
}

export type Token = CombatToken | OtherToken;

export interface DerivedTokenState {
	fluxState: string;
	fluxPercentage: number;
	hullPercentage: number;
	armorPercentages: number[];
	phaseAAvailable: number;
	phaseCAvailable: number;
	turnAngleAvailable: number;
	weaponsReady: number;
	weaponsTotal: number;
}

export function createCombatToken(
	$id: string,
	inventoryToken: InventoryToken,
	position: Point,
	heading: number = 0,
	faction?: Faction,
	ownerId?: string
): CombatToken {
	const spec = inventoryToken.spec;

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

	return {
		$id,
		$presetRef: inventoryToken.$presetRef,
		spec,
		runtime,
		metadata: inventoryToken.metadata,
	};
}

export function calculateDerivedState(token: CombatToken): DerivedTokenState {
	const spec = token.spec;
	const runtime = token.runtime;
	if (!runtime) {
		return createDefaultDerivedState(spec);
	}

	const totalFlux = (runtime.fluxSoft ?? 0) + (runtime.fluxHard ?? 0);
	const fluxCapacity = spec.fluxCapacity ?? 100;
	const fluxRatio = totalFlux / fluxCapacity;

	let fluxState = "NORMAL";
	if (runtime.overloaded) {
		fluxState = "OVERLOADED";
	} else if (runtime.venting) {
		fluxState = "VENTING";
	} else if (fluxRatio >= 0.7) {
		fluxState = "HIGH";
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
		fluxState: "NORMAL",
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

export function updateTokenRuntime(token: CombatToken, runtimeUpdates: Partial<TokenRuntime>): CombatToken {
	const currentRuntime = token.runtime;
	if (!currentRuntime) {
		return {
			...token,
			runtime: runtimeUpdates as TokenRuntime,
		};
	}

	return {
		...token,
		runtime: {
			...currentRuntime,
			...runtimeUpdates,
		},
	};
}

export function applyDamage(
	token: CombatToken,
	hullDamage: number,
	armorDamage: number,
	armorQuadrant: number,
	fluxHardGenerated: number,
	shieldHit: boolean
): CombatToken {
	const runtime = token.runtime;
	if (!runtime) return token;

	const newHull = Math.max(0, runtime.hull - hullDamage);
	const newArmor = [...runtime.armor] as [number, number, number, number, number, number];
	if (armorQuadrant >= 0 && armorQuadrant < 6) {
		newArmor[armorQuadrant] = Math.max(0, (newArmor[armorQuadrant] ?? 0) - armorDamage);
	}

	const newFluxHard = shieldHit
		? (runtime.fluxHard ?? 0) + fluxHardGenerated
		: runtime.fluxHard;

	const spec = token.spec;
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

export function moveToken(token: CombatToken, newPosition: Point, phase: "A" | "C", distance: number): CombatToken {
	const runtime = token.runtime;
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

export function rotateToken(token: CombatToken, newHeading: number, angleUsed: number): CombatToken {
	const runtime = token.runtime;
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

export function advanceMovementPhase(token: CombatToken): CombatToken {
	const runtime = token.runtime;
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

export function canAct(token: Token): boolean {
	if (!isCombatToken(token)) return false;
	const runtime = token.runtime;
	if (!runtime) return false;
	return !runtime.destroyed && !runtime.overloaded;
}

export function isDestroyed(token: Token): boolean {
	if (!isCombatToken(token)) return false;
	return token.runtime?.destroyed ?? false;
}

export function getTokenName(token: Token): string {
	if (isCombatToken(token)) {
		return token.metadata.name;
	}
	return `Token_${token.$id.substring(0, 8)}`;
}

export function getTokenPosition(token: Token): Point {
	if (isCombatToken(token)) {
		return token.runtime?.position ?? { x: 0, y: 0 };
	}
	return token.runtime?.position ?? { x: 0, y: 0 };
}

export function getTokenHeading(token: Token): number {
	if (isCombatToken(token)) {
		return token.runtime?.heading ?? 0;
	}
	return token.runtime?.heading ?? 0;
}

export function getTokenFaction(token: Token): Faction {
	if (isCombatToken(token)) {
		return token.runtime?.faction ?? FactionEnum.NEUTRAL;
	}
	return token.runtime?.faction ?? FactionEnum.NEUTRAL;
}

export function isCombatToken(token: Token): token is CombatToken {
	return 'runtime' in token && token.runtime !== undefined;
}

export function stripRuntime(token: CombatToken): InventoryToken {
	return {
		$id: token.$id,
		$presetRef: token.$presetRef,
		spec: token.spec,
		metadata: token.metadata,
	};
}