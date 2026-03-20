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
import {
	type MovementState,
	type MovementAction,
	type MovementType,
	createDefaultMovementState,
	resetMovementState,
	canExecutePhase,
} from "@vt/shared/types";

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
	private _movementState: MovementState;

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
		this._movementState = createDefaultMovementState(config.speed, config.maneuverability);
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

	get movementState(): MovementState {
		return { ...this._movementState };
	}

	/**
	 * 获取移动状态（方法形式）
	 * @returns 当前移动状态的副本
	 */
	getMovementState(): MovementState {
		return { ...this._movementState };
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

	/**
	 * 重置移动阶段（新回合开始时调用）
	 */
	resetMovementPhase(): void {
		this._movementState = resetMovementState(this._movementState);
	}

	/**
	 * 获取当前可执行的移动阶段
	 */
	getCurrentPhase(): ShipMovementPhase {
		return this._movementState.currentPhase as ShipMovementPhase;
	}

	/**
	 * 检查是否可以执行指定阶段的移动
	 */
	canExecutePhase(phase: ShipMovementPhase): boolean {
		return canExecutePhase(this._movementState, phase);
	}

	/**
	 * 执行阶段移动（新方法）
	 * @param command 移动命令
	 * @returns 验证结果
	 */
	executePhaseMovement(command: MovementAction): MovementValidationResult {
		// 验证当前阶段是否可执行
		if (!this.canExecutePhase(command.type === 'rotate' ? 2 as ShipMovementPhase : (this._movementState.phase1Complete ? 3 as ShipMovementPhase : 1 as ShipMovementPhase))) {
			const currentPhase = this._movementState.currentPhase;
			const phaseNames = ['', '平移A', '转向', '平移B'];
			return {
				isValid: false,
				reason: `当前阶段不正确。当前应执行：${phaseNames[currentPhase]}`,
			};
		}

		// 验证舰船状态
		if (this._isShipDisabled()) {
			return {
				isValid: false,
				reason: "舰船已过载或禁用，无法移动",
			};
		}

		if (this._fluxSystem.state === "VENTING") {
			return {
				isValid: false,
				reason: "舰船正在排散，无法移动",
			};
		}

		const phase = this._movementState.currentPhase;

		// 根据移动类型验证
		if (command.type === 'rotate') {
			// 阶段2必须是转向
			if (phase !== 2) {
				return {
					isValid: false,
					reason: "转向只能在阶段2执行",
				};
			}
			const rotationValidation = this._validateRotation(command.angle ?? 0);
			if (!rotationValidation.isValid) {
				return rotationValidation;
			}
		} else {
			// 阶段1和3必须是平移
			if (phase !== 1 && phase !== 3) {
				return {
					isValid: false,
					reason: "平移只能在阶段1或阶段3执行",
				};
			}
			const translationValidation = this._validateTranslationByType(
				command.type,
				command.distance ?? 0
			);
			if (!translationValidation.isValid) {
				return translationValidation;
			}
		}

		// 执行移动
		this._executeMovement(command);

		// 更新阶段状态
		this._updatePhaseState(phase);

		return { isValid: true };
	}

	/**
	 * 根据移动类型执行移动
	 */
	private _executeMovement(command: MovementAction): void {
		const oldPosition = { ...this._position };
		const oldHeading = this._heading;

		if (command.type === 'rotate') {
			// 转向
			const rotation = command.angle ?? 0;
			this._heading = ((this._heading + rotation) % 360 + 360) % 360;
		} else {
			// 平移（前进/后退或横移）
			this._position.x = command.newX;
			this._position.y = command.newY;
		}

		// 记录移动历史
		this._movementState.movementHistory.push(command);

		// 发送事件
		this._events.push({
			type: "SHIP_MOVED",
			timestamp: Date.now(),
			shipId: this._id,
			previousPosition: oldPosition,
			newPosition: { ...this._position },
			previousHeading: oldHeading,
			newHeading: this._heading,
			phase: this._movementState.currentPhase,
		});
	}

	/**
	 * 更新阶段状态
	 */
	private _updatePhaseState(completedPhase: number): void {
		switch (completedPhase) {
			case 1:
				this._movementState.phase1Complete = true;
				this._movementState.currentPhase = 2;
				break;
			case 2:
				this._movementState.phase2Complete = true;
				this._movementState.currentPhase = 3;
				break;
			case 3:
				this._movementState.phase3Complete = true;
				// 所有阶段完成，保持阶段3
				break;
		}
	}

	/**
	 * 根据移动类型验证平移
	 */
	private _validateTranslationByType(type: MovementType, distance: number): MovementValidationResult {
		const absDistance = Math.abs(distance);

		if (type === 'straight') {
			// 前进/后退：最大 2 * speed
			if (absDistance > this._speed * 2) {
				return {
					isValid: false,
					reason: `前进/后退距离超过最大值 ${this._speed * 2}`,
				};
			}
		} else if (type === 'strafe') {
			// 横移：最大 speed
			if (absDistance > this._speed) {
				return {
					isValid: false,
					reason: `横移距离超过最大值 ${this._speed}`,
				};
			}
		}

		return { isValid: true };
	}

	/**
	 * 验证移动（兼容旧接口）
	 */
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

		// 检查阶段是否可执行
		if (!this.canExecutePhase(phase)) {
			const phaseNames = ['', '平移A', '转向', '平移B'];
			const currentPhase = this._movementState.currentPhase;
			return {
				isValid: false,
				reason: `阶段顺序错误。当前应执行：${phaseNames[currentPhase]}`,
			};
		}

		if (phase === 2) {
			// 阶段2只允许转向，不允许平移
			const distance = Math.sqrt(displacement.x ** 2 + displacement.y ** 2);
			if (distance > EPSILON) {
				return {
					isValid: false,
					reason: "阶段2只能转向，不能平移",
				};
			}
			return this._validateRotation(rotation);
		}

		// 阶段1和3只允许平移，不允许转向
		if (Math.abs(rotation) > EPSILON) {
			return {
				isValid: false,
				reason: "阶段1和3只能平移，不能转向",
			};
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
		const angleRad = (this._heading * Math.PI) / 180;
		const headingVec = { x: Math.cos(angleRad), y: Math.sin(angleRad) };
		const perpVec = { x: -Math.sin(angleRad), y: Math.cos(angleRad) };

		const forwardComponent = displacement.x * headingVec.x + displacement.y * headingVec.y;
		const strafeComponent = displacement.x * perpVec.x + displacement.y * perpVec.y;

		const absForward = Math.abs(forwardComponent);
		const absStrafe = Math.abs(strafeComponent);

		// 前进验证：最大 2 * speed
		if (absForward > this._speed * 2 + EPSILON) {
			return {
				isValid: false,
				reason: `Forward movement exceeds maximum distance of ${this._speed * 2}`,
			};
		}

		// 横移验证：最大 speed
		if (absStrafe > this._speed + EPSILON) {
			return {
				isValid: false,
				reason: `Strafe movement exceeds maximum distance of ${this._speed}`,
			};
		}

		return { isValid: true };
	}

	/**
	 * 执行移动（兼容旧接口）
	 */
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

		// 更新阶段状态
		this._updatePhaseState(phase);

		// 记录移动历史
		const movementAction: MovementAction = {
			type: phase === 2 ? 'rotate' : 'straight',
			distance: phase !== 2 ? Math.sqrt(displacement.x ** 2 + displacement.y ** 2) : undefined,
			angle: phase === 2 ? rotation : undefined,
			newX: this._position.x,
			newY: this._position.y,
			newHeading: this._heading,
			timestamp: Date.now(),
		};
		this._movementState.movementHistory.push(movementAction);

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

	/**
	 * 从过载状态恢复
	 * 与 endOverload 相同，但更明确的命名
	 */
	recoverFromOverload(): void {
		this.endOverload();
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
