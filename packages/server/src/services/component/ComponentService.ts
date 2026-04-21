/**
 * ComponentService - 组件服务
 *
 * 管理舰船组件定义和效果计算
 * 组件类型：引擎、护盾、辐能电容、火控、传感器等
 */

import type { ShipJSON } from "@vt/data";

export type ComponentType =
	| "ENGINE"
	| "SHIELD_GENERATOR"
	| "FLUX_CAPACITOR"
	| "WEAPON_CONTROL"
	| "SENSOR_ARRAY"
	| "COMMUNICATIONS"
	| "DEFENSE_MATRIX";

export interface ComponentSpec {
	id: string;
	name: string;
	type: ComponentType;
	description?: string;
	stats: Record<string, number>;
	requirements?: {
		shipSize?: string[];
		shipClass?: string[];
		power?: number;
		slots?: number;
	};
	effects?: {
		modifiers?: Record<string, number>;
		abilities?: string[];
	};
}

export interface ComponentRuntime {
	componentId: string;
	active: boolean;
	health: number;
	cooldown?: number;
	statusEffects?: string[];
}

const DEFAULT_COMPONENTS: ComponentSpec[] = [
	{
		id: "engine_basic",
		name: "基础推进器",
		type: "ENGINE",
		description: "标准舰船推进系统",
		stats: { speedBonus: 0.1, turnRateBonus: 0.1, powerConsumption: 5 },
		requirements: { power: 10 },
	},
	{
		id: "shield_basic",
		name: "基础护盾发生器",
		type: "SHIELD_GENERATOR",
		description: "标准能量护盾系统",
		stats: { shieldStrength: 100, shieldEfficiency: 0.9, rechargeRate: 10, powerConsumption: 15 },
		requirements: { shipSize: ["DESTROYER", "CRUISER", "CAPITAL"], power: 20 },
	},
	{
		id: "flux_capacitor_basic",
		name: "基础辐能电容器",
		type: "FLUX_CAPACITOR",
		description: "能量存储和调节系统",
		stats: { capacityBonus: 0.2, dissipationBonus: 0.15, overloadRecovery: 0.1, powerConsumption: 8 },
	},
	{
		id: "weapon_control_basic",
		name: "基础火控系统",
		type: "WEAPON_CONTROL",
		description: "武器瞄准和控制系统",
		stats: { accuracyBonus: 0.05, rangeBonus: 0.1, cooldownReduction: 0.05, powerConsumption: 12 },
	},
	{
		id: "sensor_basic",
		name: "基础传感器阵列",
		type: "SENSOR_ARRAY",
		description: "目标探测和追踪系统",
		stats: { detectionRange: 500, trackingAccuracy: 0.8, lockOnTime: 2.0, powerConsumption: 6 },
	},
];

export class ComponentService {
	private components = new Map<string, ComponentSpec>();

	constructor() {
		for (const comp of DEFAULT_COMPONENTS) {
			this.components.set(comp.id, comp);
		}
	}

	getComponentById(id: string): ComponentSpec | null {
		return this.components.get(id) ?? null;
	}

	getAllComponents(): ComponentSpec[] {
		return Array.from(this.components.values());
	}

	getComponentsByType(type: ComponentType): ComponentSpec[] {
		return this.getAllComponents().filter((c) => c.type === type);
	}

	checkComponentCompatibility(componentId: string, shipJson: ShipJSON): boolean {
		const component = this.getComponentById(componentId);
		if (!component?.requirements) return true;

		const req = component.requirements;

		if (req.shipSize && !req.shipSize.includes(shipJson.token.size)) return false;
		if (req.shipClass && !req.shipClass.includes(shipJson.token.class)) return false;
		if (req.power) {
			const availablePower = shipJson.token.fluxCapacity ?? 100;
			if (req.power > availablePower * 0.3) return false;
		}

		return true;
	}

	createRuntimeComponent(componentId: string): ComponentRuntime {
		return {
			componentId,
			active: true,
			health: 100,
			cooldown: 0,
			statusEffects: [],
		};
	}

	calculateComponentEffects(componentIds: string[]): Record<string, number> {
		const effects: Record<string, number> = {};

		for (const id of componentIds) {
			const comp = this.getComponentById(id);
			if (!comp?.effects?.modifiers) continue;

			for (const [key, value] of Object.entries(comp.effects.modifiers)) {
				effects[key] = (effects[key] ?? 0) + value;
			}
		}

		return effects;
	}

	addComponent(component: ComponentSpec): void {
		this.components.set(component.id, component);
	}

	validateComponent(data: unknown): { valid: boolean; errors?: string[] } {
		if (!data || typeof data !== "object") {
			return { valid: false, errors: ["Invalid component data"] };
		}

		const comp = data as Partial<ComponentSpec>;
		const errors: string[] = [];

		if (!comp.id) errors.push("Missing component ID");
		if (!comp.name) errors.push("Missing component name");
		if (!comp.type) errors.push("Missing component type");
		if (!comp.stats) errors.push("Missing component stats");

		const validTypes: ComponentType[] = [
			"ENGINE", "SHIELD_GENERATOR", "FLUX_CAPACITOR",
			"WEAPON_CONTROL", "SENSOR_ARRAY", "COMMUNICATIONS", "DEFENSE_MATRIX"
		];

		if (comp.type && !validTypes.includes(comp.type)) {
			errors.push(`Invalid component type: ${comp.type}`);
		}

		if (errors.length === 0) {
			return { valid: true };
		}
		return { valid: false, errors };
	}
}

export const componentService = new ComponentService();