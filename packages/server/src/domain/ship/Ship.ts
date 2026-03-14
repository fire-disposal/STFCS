import { Shield } from "./Shield";
import { FluxSystem } from "./FluxSystem";
import { ShipStatusValues } from "./ShipStatus";
import type { Point } from "../../types/geometry";
import { ArmorQuadrant } from "./ArmorQuadrant";
import type { ShipEvent } from "./events";
import {
	type IShip,
	type MovementValidationResult,
	type ShipConfig,
	type ShipMovementPhase,
	type ShipArmorQuadrantType,
} from "./types";
import type { ShipStatus } from "./ShipStatus";

// 魔法数字常量
const EPSILON = 0.001;

const SHIP_ARMOR_TYPES: ShipArmorQuadrantType[] = [
	"FRONT_TOP",
	"FRONT_BOTTOM",
	"LEFT_TOP",
	"LEFT_BOTTOM",
	"RIGHT_TOP",
	"RIGHT_BOTTOM",
];

export class Ship implements IShip {
	private readonly _id: string;
	private _position: Point;
	private _heading: number;
	private readonly _speed: number;
	private readonly _maneuverability: number;
	private readonly _armorQuadrants: Map<ShipArmorQuadrantType, ArmorQuadrant<ShipArmorQuadrantType>>;
	private _shield: Shield | null;
	private readonly _fluxSystem: FluxSystem;
	private _status: ShipStatus;
	private readonly _events: ShipEvent[];

	constructor(config: ShipConfig) {
		if (config.speed <= 0) {
			throw new Error("Ship speed must be positive");
		}
		if (config.maneuverability <= 0) {
			throw new Error("Ship maneuverability must be positive");
		}

		this._id = config.id;
		this._position = { ...config.initialPosition };
		this._heading = ((config.initialHeading % 360) + 360) % 360;
		this._speed = config.speed;
		this._maneuverability = config.maneuverability;
		this._armorQuadrants = this._initializeArmorQuadrants(config.armor);
		this._shield = config.shield ? new Shield(config.shield, false) : null;
		this._fluxSystem = new FluxSystem(config.flux);
		this._status = this._fluxSystem.isOverloaded
			? ShipStatusValues.OVERLOADED
			: ShipStatusValues.NORMAL;
		this._events = [];
	}

	// ====== 简化 Getter 方法 ======
	get id(): string {
		return this._id;
	}

	get position(): Point {
		return { ...this._position };
	}

	get heading(): number {
		return this._heading;
	}

	get speed(): number {
		return this._speed;
	}

	get maneuverability(): number {
		return this._maneuverability;
	}

	get status(): ShipStatus {
		return this._status;
	}

	get flux(): FluxSystem {
		return this._fluxSystem;
	}

	get shield(): Shield | null {
		return this._shield;
	}

	get armorQuadrants(): Map<ShipArmorQuadrantType, ArmorQuadrant<ShipArmorQuadrantType>> {
		return new Map(this._armorQuadrants);
	}

	get events(): ShipEvent[] {
		return [...this._events];
	}

	// ====== 装甲相关方法 ======
	getHull(): number {
		return Array.from(this._armorQuadrants.values()).reduce(
			(sum, q) => sum + q.value,
			0
		);
	}

	getArmorQuadrant(type: ShipArmorQuadrantType): ArmorQuadrant<ShipArmorQuadrantType> | undefined {
		return this._armorQuadrants.get(type);
	}

	// ====== 护盾相关方法 ======
	enableShield(): void {
		if (!this._shield) return;
		this._shield.activate();
		this._pushShieldEvent(true);
	}

	disableShield(): void {
		if (!this._shield) return;
		this._shield.deactivate();
		this._pushShieldEvent(false);
	}

	toggleShield(): void {
		if (!this._shield) return;
		this._shield.toggle();
		this._pushShieldEvent(this._shield.isActive);
	}

	private _pushShieldEvent(isActive: boolean): void {
		this._events.push({
			type: "SHIELD_TOGGLED",
			timestamp: Date.now(),
			shipId: this._id,
			isActive,
		});
	}

	payShieldMaintenance(): void {
		if (!this._shield?.isActive) return;

		const cost = this._shield.maintenanceCost;
		this._fluxSystem.addSoftFlux(cost);
		this._events.push({
			type: "SHIELD_MAINTENANCE",
			timestamp: Date.now(),
			shipId: this._id,
			fluxCost: cost,
		});
	}

	// ====== 移动验证和执行 ======
	validateMovement(
		displacement: Point,
		rotation: number,
		phase: ShipMovementPhase
	): MovementValidationResult {
		if (this._isShipDisabled()) {
			return {
				isValid: false,
				reason: "Ship is overloaded or disabled",
			};
		}

		if (this._fluxSystem.state === "VENTING") {
			return {
				isValid: false,
				reason: "Ship is venting and cannot move",
			};
		}

		if (phase === 2) {
			return this._validateRotation(rotation);
		}

		return this._validateTranslation(displacement, phase);
	}

	private _isShipDisabled(): boolean {
		return this._status === ShipStatusValues.OVERLOADED || this._status === ShipStatusValues.DISABLED;
	}

	private _validateRotation(rotation: number): MovementValidationResult {
		const absRotation = Math.abs(rotation);
		if (absRotation > this._maneuverability) {
			return {
				isValid: false,
				reason: `Rotation exceeds maximum angle of ${this._maneuverability} degrees`,
			};
		}

		return { isValid: true };
	}

	private _validateTranslation(
		displacement: Point,
		phase: ShipMovementPhase
	): MovementValidationResult {
		const distance = Math.sqrt(displacement.x ** 2 + displacement.y ** 2);
		const angleRad = (this._heading * Math.PI) / 180;
		const headingVec = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
		const perpVec = { x: -Math.sin(angleRad), y: Math.cos(angleRad) };

		const forwardComponent = displacement.x * headingVec.x + displacement.y * headingVec.y;
		const strafeComponent = displacement.x * perpVec.x + displacement.y * perpVec.y;

		const absForward = Math.abs(forwardComponent);
		const absStrafe = Math.abs(strafeComponent);

		// 检查是否混合了前进和横移
		if (absStrafe > EPSILON && absForward > EPSILON) {
			return {
				isValid: false,
				reason: "Cannot combine forward and strafe movement in phase 1/3",
			};
		}

		// 前进验证
		if (absForward > EPSILON && absForward > this._speed * 2) {
			return {
				isValid: false,
				reason: `Forward movement exceeds maximum distance of ${this._speed * 2}`,
			};
		}

		// 横移验证
		if (absStrafe > EPSILON && absStrafe > this._speed) {
			return {
				isValid: false,
				reason: `Strafe movement exceeds maximum distance of ${this._speed}`,
			};
		}

		return { isValid: true };
	}

	move(displacement: Point, rotation: number, phase: ShipMovementPhase): boolean {
		const validation = this.validateMovement(displacement, rotation, phase);
		if (!validation.isValid) {
			return false;
		}

		const oldPosition = { ...this._position };
		const oldHeading = this._heading;

		if (phase === 1 || phase === 3) {
			this._position.x += displacement.x;
			this._position.y += displacement.y;
		}

		if (phase === 2) {
			this._heading = ((this._heading + rotation) % 360 + 360) % 360;
		}

		this._events.push({
			type: "SHIP_MOVED",
			timestamp: Date.now(),
			shipId: this._id,
			previousPosition: oldPosition,
			newPosition: { ...this._position },
			previousHeading: oldHeading,
			newHeading: this._heading,
			phase,
		});

		return true;
	}

	// ====== Flux 系统管理 ======
	beginVent(): boolean {
		if (this._fluxSystem.state === "OVERLOADED") {
			return false;
		}
		this._fluxSystem.vent();
		this._status = ShipStatusValues.VENTING;
		return true;
	}

	endVent(): void {
		if (this._fluxSystem.state === "VENTING") {
			this._fluxSystem.endVent();
			this._status = ShipStatusValues.NORMAL;
		}
	}

	startOverload(): void {
		this._fluxSystem.triggerOverload();
		this._status = ShipStatusValues.OVERLOADED;
		this._events.push({
			type: "FLUX_OVERLOADED",
			timestamp: Date.now(),
			shipId: this._id,
			fluxLevel: this._fluxSystem.current,
			capacity: this._fluxSystem.capacity,
		});
	}

	endOverload(): void {
		if (this._fluxSystem.state === "OVERLOADED") {
			this._fluxSystem.endOverload();
			this._status = ShipStatusValues.NORMAL;
		}
	}

	startTurn(): void {
		this._fluxSystem.dissipate();
	}

	endTurn(): void {
		if (this._fluxSystem.current >= this._fluxSystem.capacity) {
			this.startOverload();
		}
	}

	// ====== 事件管理 ======
	clearEvents(): void {
		this._events.length = 0;
	}

	// ====== 复制/克隆 ======
	copy(): Ship {
		const config: ShipConfig = {
			id: this._id,
			initialPosition: this._position,
			initialHeading: this._heading,
			speed: this._speed,
			maneuverability: this._maneuverability,
			armor: {},
			flux: {
				capacity: this._fluxSystem.capacity,
				dissipation: this._fluxSystem.dissipation,
				initialSoftFlux: this._fluxSystem.softFlux,
				initialHardFlux: this._fluxSystem.hardFlux,
			},
		};

		for (const [type, quadrant] of this._armorQuadrants) {
			config.armor[type] = {
				maxValue: quadrant.maxValue,
				initialValue: quadrant.value,
			};
		}

		if (this._shield) {
			config.shield = {
				type: this._shield.type,
				radius: this._shield.radius,
				centerOffset: this._shield.centerOffset,
				coverageAngle: this._shield.coverageAngle,
				efficiency: this._shield.efficiency,
				maintenanceCost: this._shield.maintenanceCost,
			};
		}

		return new Ship(config);
	}

	private _initializeArmorQuadrants(
		armor: Partial<Record<ShipArmorQuadrantType, { maxValue: number; initialValue?: number }>>
	): Map<ShipArmorQuadrantType, ArmorQuadrant<ShipArmorQuadrantType>> {
		const quadrants = new Map<ShipArmorQuadrantType, ArmorQuadrant<ShipArmorQuadrantType>>();

		for (const type of SHIP_ARMOR_TYPES) {
			const config = armor[type];
			if (!config) {
				throw new Error(`Missing armor configuration for quadrant ${type}`);
			}
			quadrants.set(type, new ArmorQuadrant(type, config.maxValue, config.initialValue));
		}

		return quadrants;
	}
}
