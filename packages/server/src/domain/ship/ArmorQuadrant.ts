/**
 * 装甲象限
 * 使用泛型支持不同的装甲象限类型系统
 */

export interface IArmorQuadrant<T extends string = string> {
	readonly type: T;
	readonly value: number;
	readonly maxValue: number;
}

export class ArmorQuadrant<T extends string = string> implements IArmorQuadrant<T> {
	private readonly _type: T;
	private _value: number;
	private readonly _maxValue: number;

	constructor(type: T, maxValue: number, initialValue?: number) {
		if (maxValue <= 0) {
			throw new Error("Armor quadrant max value must be positive");
		}
		this._type = type;
		this._maxValue = maxValue;
		this._value =
			initialValue !== undefined ? Math.max(0, Math.min(initialValue, maxValue)) : maxValue;
	}

	get type(): T {
		return this._type;
	}

	get value(): number {
		return this._value;
	}

	get maxValue(): number {
		return this._maxValue;
	}

	get damageReduction(): number {
		return this._value / this._maxValue;
	}

	takeDamage(amount: number): number {
		if (amount < 0) {
			throw new Error("Damage amount cannot be negative");
		}
		const actualDamage = Math.min(amount, this._value);
		this._value -= actualDamage;
		return actualDamage;
	}

	repair(amount: number): number {
		if (amount < 0) {
			throw new Error("Repair amount cannot be negative");
		}
		const oldVal = this._value;
		this._value = Math.min(this._maxValue, this._value + amount);
		return this._value - oldVal;
	}

	isDestroyed(): boolean {
		return this._value <= 0;
	}

	copy(): ArmorQuadrant<T> {
		return new ArmorQuadrant<T>(this._type, this._maxValue, this._value);
	}
}
