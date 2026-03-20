import { Weapon } from "../../domain/weapon/Weapon";
import { WeaponMountEntity, type WeaponMountConfig } from "../../domain/weapon/WeaponMount";
import { DamageCalculator, type DamageCalculationResult } from "../../domain/weapon/DamageCalculator";
import { Ship } from "../../domain/ship/Ship";
import type { Point } from "../../types/geometry";
import type { Result } from "@vt/shared/types";
import type { ArmorQuadrant } from "@vt/shared/types";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import type { IWSServer, WSMessage } from "@vt/shared/ws";

// 魔法数字常量
const LINE_OF_SIGHT_OBSTACLE_RADIUS = 10;
const BASE_HIT_CHANCE = 0.9;
const EVASION_FACTOR = 0.02;

/**
 * 伤害类型修正系数
 */
export const DAMAGE_TYPE_MODIFIERS = {
	KINETIC: { shield: 2.0, armor: 0.5, hull: 1.0 },
	HIGH_EXPLOSIVE: { shield: 0.5, armor: 2.0, hull: 1.0 },
	FRAGMENTATION: { shield: 0.25, armor: 0.25, hull: 1.0 },
	ENERGY: { shield: 1.0, armor: 1.0, hull: 1.0 },
} as const;

export interface AttackCommand {
	sourceShipId: string;
	targetShipId: string;
	weaponMountId: string;
	timestamp: number;
}

export interface FireWeaponResult {
	hit: boolean;
	damageResult: DamageCalculationResult;
	fluxCost: number;
	overloadTriggered: boolean;
}

export interface CombatLogEntry {
	id: string;
	timestamp: number;
	roundNumber: number;
	sourceShipId: string;
	targetShipId: string;
	weaponId: string;
	hit: boolean;
	damage: number;
	shieldAbsorbed: number;
	armorReduced: number;
	hullDamage: number;
	hitQuadrant?: ArmorQuadrant;
	overloaded?: boolean;
}

export interface CombatServiceDeps {
	getShip(shipId: string): Ship | null;
	applyDamageToShip(shipId: string, result: DamageCalculationResult): void;
	addFluxToShip(shipId: string, softFlux: number, hardFlux: number): void;
	triggerOverload(shipId: string): void;
	getRoundNumber(): number;
}

export type AttackValidationResult =
	| { canAttack: true }
	| { canAttack: false; reason: string };

// ====== 战斗交互状态 ======

/** 目标选择状态 */
interface TargetSelection {
	targetId: string;
	targetInfo?: {
		id: string;
		name?: string;
		hullSize?: string;
		position: { x: number; y: number };
		heading: number;
		distance: number;
	};
}

/** 武器选择状态 */
interface WeaponSelection {
	weaponInstanceId: string;
	weaponInfo?: {
		instanceId: string;
		weaponId: string;
		name: string;
		damageType: string;
		baseDamage: number;
		range: number;
		arc: number;
		state: string;
		canFire: boolean;
	};
}

/** 象限选择状态 */
interface QuadrantSelection {
	targetId: string;
	quadrant: ArmorQuadrant;
	quadrantInfo?: {
		quadrant: string;
		currentArmor: number;
		maxArmor: number;
		armorPercent: number;
	};
}

/** 攻击预览结果 */
export interface AttackPreviewData {
	canAttack: boolean;
	preview?: {
		baseDamage: number;
		estimatedShieldAbsorb: number;
		estimatedArmorReduction: number;
		estimatedHullDamage: number;
		hitQuadrant: ArmorQuadrant;
		fluxCost: number;
		willGenerateHardFlux: boolean;
	};
	blockReason?: string;
}

export class CombatService {
	private readonly _weaponMounts: Map<string, WeaponMountEntity>;
	private readonly _weapons: Map<string, Weapon>;
	private readonly _deps: CombatServiceDeps;
	private readonly _combatLog: CombatLogEntry[];
	private _wsServer?: IWSServer;
	private _roomManager?: { broadcastToRoom: (roomId: string, message: WSMessage) => void };
	private _entryIdCounter: number = 0;

	// 战斗交互状态存储
	private readonly _targetSelections: Map<string, TargetSelection> = new Map();
	private readonly _weaponSelections: Map<string, WeaponSelection> = new Map();
	private readonly _quadrantSelections: Map<string, QuadrantSelection> = new Map();

	constructor(deps: CombatServiceDeps) {
		this._weaponMounts = new Map();
		this._weapons = new Map();
		this._deps = deps;
		this._combatLog = [];
	}

	setWSServer(wsServer: IWSServer): void {
		this._wsServer = wsServer;
	}

	setRoomManager(roomManager: { broadcastToRoom: (roomId: string, message: WSMessage) => void }): void {
		this._roomManager = roomManager;
	}

	registerWeapon(weapon: Weapon): void {
		this._weapons.set(weapon.id, weapon);
	}

	registerWeaponMount(config: WeaponMountConfig): void {
		const mount = new WeaponMountEntity(config);
		this._weaponMounts.set(mount.id, mount);
	}

	getWeapon(weaponId: string): Weapon | undefined {
		return this._weapons.get(weaponId);
	}

	getWeaponMount(mountId: string): WeaponMountEntity | undefined {
		return this._weaponMounts.get(mountId);
	}

	getRegisteredMounts(): WeaponMountEntity[] {
		return Array.from(this._weaponMounts.values());
	}

	/**
	 * 获取战斗日志
	 */
	getCombatLog(): CombatLogEntry[] {
		return [...this._combatLog];
	}

	/**
	 * 清空战斗日志
	 */
	clearCombatLog(): void {
		this._combatLog.length = 0;
	}

	// ====== 战斗交互方法 ======

	/**
	 * 选择目标
	 */
	selectTarget(attackerId: string, targetId: string): TargetSelection {
		const targetShip = this._deps.getShip(targetId);
		const attackerShip = this._deps.getShip(attackerId);

		const selection: TargetSelection = {
			targetId,
		};

		if (targetShip && attackerShip) {
			const distance = DamageCalculator.calculateDistance(attackerShip.position, targetShip.position);
			selection.targetInfo = {
				id: targetId,
				position: { x: targetShip.position.x, y: targetShip.position.y },
				heading: targetShip.heading,
				distance,
			};
		}

		this._targetSelections.set(attackerId, selection);
		return selection;
	}

	/**
	 * 清除目标选择
	 */
	clearTarget(attackerId: string): void {
		this._targetSelections.delete(attackerId);
		this._quadrantSelections.delete(attackerId);
	}

	/**
	 * 获取目标选择
	 */
	getTargetSelection(attackerId: string): TargetSelection | undefined {
		return this._targetSelections.get(attackerId);
	}

	/**
	 * 选择武器
	 */
	selectWeapon(shipId: string, weaponInstanceId: string): WeaponSelection | null {
		const mount = this._weaponMounts.get(weaponInstanceId);
		const ship = this._deps.getShip(shipId);

		if (!mount || !ship) {
			return null;
		}

		const canFire = ship.flux.current + mount.weapon.fluxCost <= ship.flux.capacity;

		const selection: WeaponSelection = {
			weaponInstanceId,
			weaponInfo: {
				instanceId: weaponInstanceId,
				weaponId: mount.weapon.id,
				name: mount.weapon.name,
				damageType: mount.weapon.type,
				baseDamage: mount.weapon.damage,
				range: mount.weapon.range,
				arc: mount.weapon.arc,
				state: 'ready', // TODO: 实际状态
				canFire,
			},
		};

		this._weaponSelections.set(shipId, selection);
		return selection;
	}

	/**
	 * 清除武器选择
	 */
	clearWeapon(shipId: string): void {
		this._weaponSelections.delete(shipId);
	}

	/**
	 * 获取武器选择
	 */
	getWeaponSelection(shipId: string): WeaponSelection | undefined {
		return this._weaponSelections.get(shipId);
	}

	/**
	 * 选择象限
	 */
	selectQuadrant(attackerId: string, targetId: string, quadrant: ArmorQuadrant): QuadrantSelection | null {
		const targetShip = this._deps.getShip(targetId);

		const selection: QuadrantSelection = {
			targetId,
			quadrant,
		};

		if (targetShip) {
			// 将象限名称转换为大写格式以匹配Ship的armorQuadrants
			const quadrantKey = quadrant.toUpperCase() as 'FRONT_TOP' | 'FRONT_BOTTOM' | 'LEFT_TOP' | 'LEFT_BOTTOM' | 'RIGHT_TOP' | 'RIGHT_BOTTOM';
			const armorQuadrant = targetShip.armorQuadrants.get(quadrantKey);

			if (armorQuadrant) {
				selection.quadrantInfo = {
					quadrant,
					currentArmor: armorQuadrant.value,
					maxArmor: armorQuadrant.maxValue,
					armorPercent: (armorQuadrant.value / armorQuadrant.maxValue) * 100,
				};
			}
		}

		this._quadrantSelections.set(attackerId, selection);
		return selection;
	}

	/**
	 * 清除象限选择
	 */
	clearQuadrant(attackerId: string): void {
		this._quadrantSelections.delete(attackerId);
	}

	/**
	 * 获取象限选择
	 */
	getQuadrantSelection(attackerId: string): QuadrantSelection | undefined {
		return this._quadrantSelections.get(attackerId);
	}

	/**
	 * 获取攻击预览
	 */
	getAttackPreview(
		attackerId: string,
		targetId: string,
		weaponInstanceId: string,
		targetQuadrant?: ArmorQuadrant
	): AttackPreviewData {
		const sourceShip = this._deps.getShip(attackerId);
		const targetShip = this._deps.getShip(targetId);
		const mount = this._weaponMounts.get(weaponInstanceId);

		if (!sourceShip || !targetShip || !mount) {
			return {
				canAttack: false,
				blockReason: 'INVALID_TARGET_OR_WEAPON',
			};
		}

		// 检查是否可以攻击
		const validation = this.canAttack(attackerId, targetId, weaponInstanceId);
		if (!validation.canAttack) {
			return {
				canAttack: false,
				blockReason: validation.reason,
			};
		}

		// 计算预览数据
		const distance = DamageCalculator.calculateDistance(sourceShip.position, targetShip.position);
		const hitQuadrant = targetQuadrant ?? this._calculateHitQuadrant(sourceShip, targetShip);

		// 计算伤害预览
		const damageInput = {
			weapon: mount.weapon,
			sourceShip,
			targetShip,
			hitPosition: targetShip.position,
		};

		const damageResult = DamageCalculator.calculateDamage(damageInput);

		return {
			canAttack: true,
			preview: {
				baseDamage: damageResult.damage,
				estimatedShieldAbsorb: damageResult.shieldAbsorbed,
				estimatedArmorReduction: damageResult.armorReduced,
				estimatedHullDamage: damageResult.hullDamage,
				hitQuadrant,
				fluxCost: mount.weapon.fluxCost,
				willGenerateHardFlux: damageResult.hardFluxGenerated > 0,
			},
		};
	}

	/**
	 * 计算命中象限
	 */
	private _calculateHitQuadrant(sourceShip: Ship, targetShip: Ship): ArmorQuadrant {
		const dx = targetShip.position.x - sourceShip.position.x;
		const dy = targetShip.position.y - sourceShip.position.y;
		const angleToTarget = Math.atan2(dy, dx);
		const relativeAngle = angleToTarget - (targetShip.heading * Math.PI / 180);

		// 标准化角度到 [-PI, PI]
		const normalizedAngle = ((relativeAngle + Math.PI) % (2 * Math.PI)) - Math.PI;

		// 根据角度确定象限
		if (normalizedAngle >= -Math.PI / 4 && normalizedAngle < Math.PI / 4) {
			return 'front';
		} else if (normalizedAngle >= Math.PI / 4 && normalizedAngle < 3 * Math.PI / 4) {
			return 'right';
		} else if (normalizedAngle >= -3 * Math.PI / 4 && normalizedAngle < -Math.PI / 4) {
			return 'left';
		} else {
			return 'rear';
		}
	}

	/**
	 * 清除所有选择状态
	 */
	clearAllSelections(attackerId: string): void {
		this._targetSelections.delete(attackerId);
		this._weaponSelections.delete(attackerId);
		this._quadrantSelections.delete(attackerId);
	}

	canAttack(sourceShipId: string, targetShipId: string, mountId: string): AttackValidationResult {
		const sourceShip = this._deps.getShip(sourceShipId);
		const targetShip = this._deps.getShip(targetShipId);
		const mount = this._weaponMounts.get(mountId);

		if (!sourceShip) {
			return { canAttack: false, reason: "Source ship not found" };
		}

		if (!targetShip) {
			return { canAttack: false, reason: "Target ship not found" };
		}

		if (!mount) {
			return { canAttack: false, reason: "Weapon mount not found" };
		}

		const distance = DamageCalculator.calculateDistance(sourceShip.position, targetShip.position);

		if (!mount.weapon.isWithinRange(distance)) {
			return { canAttack: false, reason: "Target out of range" };
		}

		if (!mount.isTargetInArc(targetShip.position, sourceShip.position)) {
			return { canAttack: false, reason: "Target not in weapon arc" };
		}

		if (sourceShip.status === "OVERLOADED" || sourceShip.status === "DISABLED") {
			return { canAttack: false, reason: "Source ship cannot fire weapons" };
		}

		// 检查辐能是否足够
		const fluxCost = mount.weapon.fluxCost;
		if (sourceShip.flux.current + fluxCost > sourceShip.flux.capacity) {
			return { canAttack: false, reason: "Not enough flux capacity" };
		}

		return { canAttack: true };
	}

	/**
	 * 计算命中概率
	 */
	calculateHitChance(sourceShip: Ship, targetShip: Ship, weapon: Weapon): number {
		// 基础命中率
		let hitChance = BASE_HIT_CHANCE;

		// 根据距离调整
		const distance = DamageCalculator.calculateDistance(sourceShip.position, targetShip.position);
		const rangeRatio = distance / weapon.range;
		if (rangeRatio > 0.8) {
			hitChance -= (rangeRatio - 0.8) * 0.5; // 远距离降低命中
		}

		// 根据目标机动性调整
		const evasion = targetShip.speed * EVASION_FACTOR;
		hitChance -= evasion;

		// 确保命中率在合理范围内
		return Math.max(0.1, Math.min(1.0, hitChance));
	}

	/**
	 * 执行攻击
	 */
	executeAttack(command: AttackCommand, roomId?: string): FireWeaponResult {
		const sourceShip = this._deps.getShip(command.sourceShipId);
		const targetShip = this._deps.getShip(command.targetShipId);
		const mount = this._weaponMounts.get(command.weaponMountId);

		const noHitResult: FireWeaponResult = {
			hit: false,
			damageResult: {
				hit: false,
				damage: 0,
				shieldAbsorbed: 0,
				armorReduced: 0,
				hullDamage: 0,
				softFluxGenerated: 0,
				hardFluxGenerated: 0,
			},
			fluxCost: 0,
			overloadTriggered: false,
		};

		if (!sourceShip || !targetShip || !mount) {
			return noHitResult;
		}

		const validation = this.canAttack(command.sourceShipId, command.targetShipId, command.weaponMountId);

		if (!validation.canAttack) {
			return noHitResult;
		}

		// 计算命中
		const hitChance = this.calculateHitChance(sourceShip, targetShip, mount.weapon);
		const hitRoll = Math.random();
		const isHit = hitRoll <= hitChance;

		if (!isHit) {
			// 未命中，但仍产生辐能
			this._deps.addFluxToShip(command.sourceShipId, mount.weapon.fluxCost, 0);

			// 记录战斗日志
			this._addCombatLogEntry({
				sourceShipId: command.sourceShipId,
				targetShipId: command.targetShipId,
				weaponId: mount.weapon.id,
				hit: false,
				damage: 0,
				shieldAbsorbed: 0,
				armorReduced: 0,
				hullDamage: 0,
			});

			return {
				...noHitResult,
				fluxCost: mount.weapon.fluxCost,
			};
		}

		// 计算伤害
		const damageInput = {
			weapon: mount.weapon,
			sourceShip,
			targetShip,
			hitPosition: targetShip.position,
		};

		const damageResult = DamageCalculator.calculateDamage(damageInput);

		// 应用伤害
		this._deps.applyDamageToShip(command.targetShipId, damageResult);

		// 添加辐能
		this._deps.addFluxToShip(
			command.sourceShipId,
			damageResult.softFluxGenerated,
			damageResult.hardFluxGenerated
		);

		// 检查是否触发过载
		let overloadTriggered = false;
		const updatedSourceShip = this._deps.getShip(command.sourceShipId);
		if (updatedSourceShip && updatedSourceShip.flux.current >= updatedSourceShip.flux.capacity) {
			this._deps.triggerOverload(command.sourceShipId);
			overloadTriggered = true;
		}

		// 记录战斗日志
		this._addCombatLogEntry({
			sourceShipId: command.sourceShipId,
			targetShipId: command.targetShipId,
			weaponId: mount.weapon.id,
			hit: true,
			damage: damageResult.damage,
			shieldAbsorbed: damageResult.shieldAbsorbed,
			armorReduced: damageResult.armorReduced,
			hullDamage: damageResult.hullDamage,
			hitQuadrant: damageResult.hitQuadrant,
			overloaded: overloadTriggered,
		});

		// 广播战斗事件
		if (roomId && this._roomManager) {
			this._roomManager.broadcastToRoom(roomId, {
				type: WS_MESSAGE_TYPES.WEAPON_FIRED,
				payload: {
					sourceShipId: command.sourceShipId,
					targetShipId: command.targetShipId,
					weaponId: mount.weapon.id,
					mountId: command.weaponMountId,
					timestamp: command.timestamp,
				},
			});

			this._roomManager.broadcastToRoom(roomId, {
				type: WS_MESSAGE_TYPES.DAMAGE_DEALT,
				payload: {
					sourceShipId: command.sourceShipId,
					targetShipId: command.targetShipId,
					hit: true,
					damage: damageResult.damage,
					shieldAbsorbed: damageResult.shieldAbsorbed,
					armorReduced: damageResult.armorReduced,
					hullDamage: damageResult.hullDamage,
					hitQuadrant: damageResult.hitQuadrant,
					softFluxGenerated: damageResult.softFluxGenerated,
					hardFluxGenerated: damageResult.hardFluxGenerated,
					timestamp: command.timestamp,
				},
			});
		}

		return {
			hit: true,
			damageResult,
			fluxCost: mount.weapon.fluxCost,
			overloadTriggered,
		};
	}

	/**
	 * 添加战斗日志条目
	 */
	private _addCombatLogEntry(entry: Omit<CombatLogEntry, 'id' | 'timestamp' | 'roundNumber'>): void {
		const logEntry: CombatLogEntry = {
			...entry,
			id: `combat_${++this._entryIdCounter}`,
			timestamp: Date.now(),
			roundNumber: this._deps.getRoundNumber(),
		};
		this._combatLog.push(logEntry);
	}

	/**
	 * 计算两点之间是否有视线遮挡
	 */
	calculateLineOfSight(from: Point, to: Point, obstacles: Point[]): boolean {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const distance = Math.sqrt(dx * dx + dy * dy);

		if (distance === 0) return true;

		const steps = Math.ceil(distance);
		const stepX = dx / steps;
		const stepY = dy / steps;

		for (let i = 1; i < steps; i++) {
			const checkX = from.x + stepX * i;
			const checkY = from.y + stepY * i;

			for (const obstacle of obstacles) {
				const obsDist = Math.sqrt((checkX - obstacle.x) ** 2 + (checkY - obstacle.y) ** 2);
				if (obsDist < LINE_OF_SIGHT_OBSTACLE_RADIUS) {
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * 获取所有可攻击的目标
	 */
	getEngageableTargets(
		sourceShipId: string,
		targetShipIds: string[]
	): Array<{ shipId: string; mountId: string; inRange: boolean; hitChance: number }> {
		const sourceShip = this._deps.getShip(sourceShipId);
		if (!sourceShip) {
			return [];
		}

		const results: Array<{ shipId: string; mountId: string; inRange: boolean; hitChance: number }> = [];

		for (const mount of this._weaponMounts.values()) {
			for (const targetId of targetShipIds) {
				const targetShip = this._deps.getShip(targetId);
				if (!targetShip) continue;

				const distance = DamageCalculator.calculateDistance(sourceShip.position, targetShip.position);

				const inRange =
					mount.weapon.isWithinRange(distance) &&
					mount.isTargetInArc(targetShip.position, sourceShip.position);

				const hitChance = inRange ? this.calculateHitChance(sourceShip, targetShip, mount.weapon) : 0;

				results.push({
					shipId: targetId,
					mountId: mount.id,
					inRange,
					hitChance,
				});
			}
		}

		return results;
	}

	/**
	 * 获取舰船的所有武器状态
	 */
	getShipWeaponStatuses(shipId: string): Array<{
		mountId: string;
		weaponId: string;
		inRange: boolean;
		canFire: boolean;
		fluxCost: number;
	}> {
		const ship = this._deps.getShip(shipId);
		if (!ship) return [];

		const statuses: Array<{
			mountId: string;
			weaponId: string;
			inRange: boolean;
			canFire: boolean;
			fluxCost: number;
		}> = [];

		for (const mount of this._weaponMounts.values()) {
			const canFire = ship.flux.current + mount.weapon.fluxCost <= ship.flux.capacity;
			statuses.push({
				mountId: mount.id,
				weaponId: mount.weapon.id,
				inRange: false, // 需要目标才能判断
				canFire,
				fluxCost: mount.weapon.fluxCost,
			});
		}

		return statuses;
	}
}

export default CombatService;
