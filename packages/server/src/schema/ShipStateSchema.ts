/**
 * 优化的舰船状态 Schema
 *
 * 设计原则：
 * 1. 平铺属性 - Colyseus Schema 性能最优
 * 2. 辅助方法 - 提供更好的可读性
 * 3. 向后兼容 - 保持现有字段名
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

/**
 * 武器槽（保持不变，已优化）
 */
export class WeaponSlot extends Schema {
	@type("string") mountId: string = "";
	@type("string") weaponSpecId: string = "";
	@type("string") name: string = "";
	@type("string") category: string = "BALLISTIC";
	@type("string") damageType: string = "KINETIC";
	@type("string") mountType: string = "TURRET";

	@type("number") offsetX: number = 0;
	@type("number") offsetY: number = 0;
	@type("number") mountFacing: number = 0;
	@type("number") arcMin: number = -90;
	@type("number") arcMax: number = 90;

	@type("number") damage: number = 0;
	@type("number") range: number = 0;
	@type("number") fluxCost: number = 0;

	@type("number") cooldownMax: number = 0;
	@type("number") cooldownRemaining: number = 0;

	@type("number") maxAmmo: number = 0;
	@type("number") currentAmmo: number = 0;
	@type("number") reloadTime: number = 0;

	@type("string") state: string = "READY";
	@type("boolean") ignoresShields: boolean = false;
	@type("boolean") hasFiredThisTurn: boolean = false;

	get isReady(): boolean {
		return this.state === "READY" && this.cooldownRemaining <= 0;
	}

	get isCoolingDown(): boolean {
		return this.cooldownRemaining > 0;
	}

	get isEmpty(): boolean {
		return this.maxAmmo > 0 && this.currentAmmo <= 0;
	}

	get hasAmmo(): boolean {
		return this.maxAmmo <= 0 || this.currentAmmo > 0;
	}

	fire(): boolean {
		if (!this.isReady || !this.hasAmmo) return false;

		this.cooldownRemaining = this.cooldownMax;
		this.hasFiredThisTurn = true;

		if (this.maxAmmo > 0) {
			this.currentAmmo = Math.max(0, this.currentAmmo - 1);
		}

		return true;
	}

	updateCooldown(deltaSeconds: number): void {
		if (this.cooldownRemaining > 0) {
			this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaSeconds);
		}
	}

	reload(): void {
		this.currentAmmo = this.maxAmmo;
		this.state = "READY";
	}
}

/**
 * 变换（位置 + 朝向）
 */
export class Transform extends Schema {
	@type("number") x: number = 0;
	@type("number") y: number = 0;
	@type("number") heading: number = 0;

	/** 距离原点的距离 */
	get distance(): number {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}

	/** 朝向弧度 */
	get headingRad(): number {
		return (this.heading * Math.PI) / 180;
	}

	/** 设置位置 */
	setPosition(x: number, y: number): void {
		this.x = x;
		this.y = y;
	}

	/** 设置朝向（角度） */
	setHeading(heading: number): void {
		this.heading = ((heading % 360) + 360) % 360;
	}

	/** 设置朝向（弧度） */
	setHeadingRad(rad: number): void {
		this.setHeading((rad * 180) / Math.PI);
	}
}

/**
 * 船体状态
 */
export class HullState extends Schema {
	@type("number") current: number = 100;
	@type("number") max: number = 100;

	/** 船体百分比 */
	get percent(): number {
		return this.max > 0 ? (this.current / this.max) * 100 : 0;
	}

	/** 是否被摧毁 */
	get isDestroyed(): boolean {
		return this.current <= 0;
	}

	/** 是否完整 */
	get isFull(): boolean {
		return this.current >= this.max;
	}

	/** 受到伤害 */
	takeDamage(amount: number): number {
		const actualDamage = Math.min(this.current, amount);
		this.current = Math.max(0, this.current - actualDamage);
		return actualDamage;
	}

	/** 修复船体 */
	repair(amount: number): number {
		const actualRepair = Math.min(this.max - this.current, amount);
		this.current = Math.min(this.max, this.current + actualRepair);
		return actualRepair;
	}
}

/**
 * 护甲状态（6 象限）
 */
export class ArmorState extends Schema {
	@type("number") maxPerQuadrant: number = 100;
	@type(["number"]) quadrants = new ArraySchema<number>(100, 100, 100, 100, 100, 100);

	getQuadrant(index: number): number {
		return this.quadrants.at(index) ?? 0;
	}

	setQuadrant(index: number, value: number): void {
		this.quadrants[index] = Math.max(0, Math.min(this.maxPerQuadrant, value));
	}

	get averagePercent(): number {
		let total = 0;
		for (let i = 0; i < 6; i++) {
			total += this.quadrants.at(i) ?? 0;
		}
		return (total / (this.maxPerQuadrant * 6)) * 100;
	}

	get isDepleted(): boolean {
		for (let i = 0; i < 6; i++) {
			if ((this.quadrants.at(i) ?? 0) > 0) return false;
		}
		return true;
	}

	takeDamage(quadrantIndex: number, amount: number): number {
		const current = this.getQuadrant(quadrantIndex);
		const actualDamage = Math.min(current, amount);
		this.setQuadrant(quadrantIndex, current - actualDamage);
		return actualDamage;
	}

	repair(quadrantIndex: number, amount: number): number {
		const current = this.getQuadrant(quadrantIndex);
		const actualRepair = Math.min(this.maxPerQuadrant - current, amount);
		this.setQuadrant(quadrantIndex, current + actualRepair);
		return actualRepair;
	}

	repairAll(): void {
		for (let i = 0; i < 6; i++) {
			this.setQuadrant(i, this.maxPerQuadrant);
		}
	}
}

/**
 * 辐能状态
 */
export class FluxState extends Schema {
	@type("number") hard: number = 0;
	@type("number") soft: number = 0;
	@type("number") max: number = 100;
	@type("number") dissipation: number = 10;

	/** 总辐能 */
	get total(): number {
		return this.hard + this.soft;
	}

	/** 辐能百分比 */
	get percent(): number {
		return this.max > 0 ? (this.total / this.max) * 100 : 0;
	}

	/** 是否过载 */
	get isOverloaded(): boolean {
		return this.total >= this.max;
	}

	/** 是否空闲（无辐能） */
	get isIdle(): boolean {
		return this.total <= 0;
	}

	/** 添加硬辐能 */
	addHard(amount: number): void {
		this.hard = Math.min(this.max, this.hard + amount);
	}

	/** 添加软辐能 */
	addSoft(amount: number): void {
		this.soft = Math.min(this.max, this.soft + amount);
	}

	/** 消散辐能（每帧调用） */
	dissipate(deltaSeconds: number): void {
		const amount = this.dissipation * deltaSeconds;

		// 先消散软辐能
		this.soft = Math.max(0, this.soft - amount);

		// 软辐能耗尽后消散硬辐能
		if (this.soft <= 0) {
			this.hard = Math.max(0, this.hard - amount);
		}
	}

	/** 主动排散（ vent 行动） */
	vent(deltaSeconds: number): number {
		const ventRate = this.dissipation * 2; // vent 时消散速率翻倍
		const dissipated = ventRate * deltaSeconds;

		this.soft = Math.max(0, this.soft - dissipated);
		this.hard = Math.max(0, this.hard - dissipated);

		return dissipated;
	}
}

/**
 * 护盾状态
 */
export class ShieldState extends Schema {
	@type("boolean") active: boolean = false;
	@type("number") orientation: number = 0;
	@type("number") arc: number = 120;
	@type("number") radius: number = 50;
	@type("number") efficiency: number = 0.5;
	@type("number") maintenanceCost: number = 5;

	/** 护盾是否朝向前方 */
	get isFrontShield(): boolean {
		return this.arc < 180;
	}

	/** 开启护盾 */
	activate(): void {
		this.active = true;
	}

	/** 关闭护盾 */
	deactivate(): void {
		this.active = false;
	}

	/** 切换护盾 */
	toggle(): void {
		this.active = !this.active;
	}

	/** 设置护盾朝向 */
	setOrientation(heading: number): void {
		this.orientation = ((heading % 360) + 360) % 360;
	}
}

/**
 * 优化的舰船状态 Schema（主类）
 */
export class ShipStateOptimized extends Schema {
	// ==================== 基础信息 ====================
	@type("string") id: string = "";
	@type("string") ownerId: string = "";
	@type("string") faction: string = "PLAYER";
	@type("string") hullType: string = "";
	@type("string") name: string = "";
	@type("number") width: number = 20;
	@type("number") length: number = 40;

	// ==================== 变换 ====================
	@type(Transform) transform = new Transform();

	// ==================== 防御系统 ====================
	@type(HullState) hull = new HullState();
	@type(ArmorState) armor = new ArmorState();
	@type(ShieldState) shield = new ShieldState();
	@type(FluxState) flux = new FluxState();

	// ==================== 状态标记 ====================
	@type("boolean") isOverloaded: boolean = false;
	@type("number") overloadTime: number = 0;
	@type("boolean") isDestroyed: boolean = false;

	// ==================== 机动性能 ====================
	@type("number") maxSpeed: number = 0;
	@type("number") maxTurnRate: number = 0;
	@type("number") acceleration: number = 0;

	// ==================== 三阶段移动 ====================
	@type("number") movePhaseAX: number = 0;
	@type("number") movePhaseAStrafe: number = 0;
	@type("number") movePhaseBX: number = 0;
	@type("number") movePhaseBStrafe: number = 0;
	@type("number") turnAngle: number = 0;

	// 燃料池追踪
	@type("number") fuelPhaseAForwardUsed: number = 0;
	@type("number") fuelPhaseAStrafeUsed: number = 0;
	@type("number") fuelPhaseBTurnUsed: number = 0;
	@type("number") fuelPhaseCForwardUsed: number = 0;
	@type("number") fuelPhaseCStrafeUsed: number = 0;
	@type("number") currentMovementPhase: number = 0;

	// ==================== 武器系统 ====================
	@type({ map: WeaponSlot }) weapons = new MapSchema<WeaponSlot>();

	// ==================== 行动状态 ====================
	@type("boolean") hasMoved: boolean = false;
	@type("boolean") hasFired: boolean = false;

	// ==================== 辅助方法 ====================

	/** 舰船是否存活 */
	get isAlive(): boolean {
		return !this.isDestroyed && !this.hull.isDestroyed;
	}

	/** 舰船是否可行动 */
	get canAct(): boolean {
		return this.isAlive && !this.isOverloaded;
	}

	/** 获取舰船中心坐标 */
	get centerX(): number {
		return this.transform.x;
	}

	get centerY(): number {
		return this.transform.y;
	}

	/** 获取舰船朝向（弧度） */
	get headingRad(): number {
		return this.transform.headingRad;
	}

	/** 设置位置 */
	setPosition(x: number, y: number): void {
		this.transform.setPosition(x, y);
	}

	/** 设置朝向 */
	setHeading(heading: number): void {
		this.transform.setHeading(heading);
	}

	/** 受到船体伤害 */
	takeHullDamage(amount: number): number {
		return this.hull.takeDamage(amount);
	}

	/** 对指定象限造成护甲伤害 */
	takeArmorDamage(quadrantIndex: number, amount: number): number {
		return this.armor.takeDamage(quadrantIndex, amount);
	}

	/** 添加硬辐能 */
	addHardFlux(amount: number): void {
		this.flux.addHard(amount);

		// 检查是否过载
		if (this.flux.isOverloaded && !this.isOverloaded) {
			this.isOverloaded = true;
		}
	}

	/** 添加软辐能 */
	addSoftFlux(amount: number): void {
		this.flux.addSoft(amount);

		// 检查是否过载
		if (this.flux.isOverloaded && !this.isOverloaded) {
			this.isOverloaded = true;
		}
	}

	/** 消散辐能 */
	dissipateFlux(deltaSeconds: number): void {
		this.flux.dissipate(deltaSeconds);

		if (this.isOverloaded && !this.flux.isOverloaded) {
			this.isOverloaded = false;
			this.overloadTime = 0;
		}
	}
}
