/**
 * 预设缓存服务
 *
 * 客户端启动时预加载所有舰船和武器预设JSON
 * 用于合并运行时状态，构建完整ShipJSON
 *
 * 使用方式：
 * 1. 启动时调用 preloadPresets()
 * 2. 通过 getShipPreset()/getWeaponPreset() 获取预设
 * 3. 使用 mergeShipRuntime() 合并运行时状态
 */

import type { ShipJSON, WeaponJSON } from "@vt/data";

/** 预设缓存状态 */
interface PresetCache {
	ships: Map<string, ShipJSON>;
	weapons: Map<string, WeaponJSON>;
	loaded: boolean;
	loading: boolean;
	error?: string;
}

const cache: PresetCache = {
	ships: new Map(),
	weapons: new Map(),
	loaded: false,
	loading: false,
};

/** API基础URL */
const API_BASE = "/api/presets";

/**
 * 预加载所有预设
 *
 * 客户端启动时调用，阻塞直到加载完成
 */
export async function preloadPresets(): Promise<{
	ships: number;
	weapons: number;
}> {
	if (cache.loaded || cache.loading) {
		return {
			ships: cache.ships.size,
			weapons: cache.weapons.size,
		};
	}

	cache.loading = true;
	cache.error = undefined;

	try {
		const response = await fetch(`${API_BASE}/all`);

		if (!response.ok) {
			throw new Error(`Failed to fetch presets: ${response.status}`);
		}

		const result = await response.json();

		if (!result.success || !result.data) {
			throw new Error(result.error || "Invalid response format");
		}

		// 建立缓存Map
		for (const ship of result.data.ships) {
			cache.ships.set(ship.$id, ship);
		}

		for (const weapon of result.data.weapons) {
			cache.weapons.set(weapon.$id, weapon);
		}

		cache.loaded = true;
		cache.loading = false;

		console.log(
			`[PresetCache] Loaded ${cache.ships.size} ships, ${cache.weapons.size} weapons`
		);

		return {
			ships: cache.ships.size,
			weapons: cache.weapons.size,
		};
	} catch (error) {
		cache.loading = false;
		cache.error = error instanceof Error ? error.message : "Unknown error";
		console.error("[PresetCache] Failed to preload presets:", error);
		throw error;
	}
}

/**
 * 获取舰船预设
 *
 * @param id 预设ID（如 "preset:frigate" 或 "frigate"）
 */
export function getShipPreset(id: string): ShipJSON | undefined {
	// 标准化ID格式
	const normalizedId = id.startsWith("preset:") ? id : `preset:${id}`;
	return cache.ships.get(normalizedId);
}

/**
 * 获取武器预设
 *
 * @param id 预设ID（如 "preset:light_autocannon_turret" 或 "light_autocannon_turret"）
 */
export function getWeaponPreset(id: string): WeaponJSON | undefined {
	const normalizedId = id.startsWith("preset:") ? id : `preset:${id}`;
	return cache.weapons.get(normalizedId);
}

/**
 * 获取所有舰船预设
 */
export function getAllShipPresets(): ShipJSON[] {
	return Array.from(cache.ships.values());
}

/**
 * 获取所有武器预设
 */
export function getAllWeaponPresets(): WeaponJSON[] {
	return Array.from(cache.weapons.values());
}

/**
 * 合并舰船预设与运行时状态
 *
 * 核心方法：将服务端同步的运行时状态与预设合并，构建完整ShipJSON
 *
 * @param presetRef 预设引用ID
 * @param runtime 运行时状态（从ShipRuntimeSlim Schema）
 */
export function mergeShipRuntime(
	presetRef: string,
	runtime: {
		id: string;
		customName?: string;
		transform: { x: number; y: number; heading: number };
		hull: { current: number };
		armor: { quadrants: number[] };
		flux: { soft: number; hard: number; overloaded?: boolean; overloadTime?: number };
		shield: { active: boolean; current?: number; orientation?: number };
		weapons: Map<string, {
			mountId: string;
			weaponRef: string;
			state: string;
			cooldownRemaining?: number;
			currentAmmo?: number;
			reloadProgress?: number;
			burstRemaining?: number;
			turretAngle?: number;
			hasFiredThisTurn?: boolean;
		}>;
		movePhase: string;
		phaseUsage?: {
			phaseAForward?: number;
			phaseAStrafe?: number;
			phaseTurn?: number;
			phaseCForward?: number;
			phaseCStrafe?: number;
		};
		hasMoved?: boolean;
		hasFired?: boolean;
		faction: string;
		ownerId?: string;
	}
): ShipJSON | null {
	// 获取预设
	const preset = getShipPreset(presetRef);
	if (!preset) {
		console.warn(`[PresetCache] Ship preset not found: ${presetRef}`);
		return null;
	}

	// 深拷贝预设
	const merged: ShipJSON = JSON.parse(JSON.stringify(preset));

	// 更新ID和来源
	merged.$id = runtime.id;
	merged.$source = "save";
	merged.$presetRef = presetRef;

	// 更新元数据
	merged.metadata.name = runtime.customName || preset.metadata.name;

	// 更新运行时状态
	merged.runtime = {
		position: { x: runtime.transform.x, y: runtime.transform.y },
		heading: runtime.transform.heading,
		hull: { current: runtime.hull.current },
		armor: {
			quadrants: runtime.armor.quadrants as [number, number, number, number, number, number],
		},
		fluxSoft: runtime.flux.soft,
		fluxHard: runtime.flux.hard,
		shieldActive: runtime.shield.active,
		shieldCurrent: runtime.shield.current ?? 100,
		shieldOrientation: runtime.shield.orientation ?? 0,
		overloaded: runtime.flux.overloaded ?? false,
		overloadTime: runtime.flux.overloadTime ?? 0,
		movePhase: runtime.movePhase as any,
		phaseUsage: runtime.phaseUsage ?? {},
		hasMoved: runtime.hasMoved ?? false,
		hasFired: runtime.hasFired ?? false,
		weapons: [],
		faction: runtime.faction as any,
		ownerId: runtime.ownerId ?? "",
	};

	// 合并武器运行时状态
	for (const mount of merged.spec.weaponMounts ?? []) {
		const weaponRuntime = runtime.weapons.get(mount.id);

		if (weaponRuntime) {
			merged.runtime!.weapons!.push({
				mountId: weaponRuntime.mountId,
				state: weaponRuntime.state as any,
				cooldownRemaining: weaponRuntime.cooldownRemaining ?? 0,
				burstRemaining: weaponRuntime.burstRemaining ?? 0,
				turretAngle: weaponRuntime.turretAngle ?? mount.facing,
			});

			// 更新武器引用
			if (weaponRuntime.weaponRef) {
				mount.weaponRef = weaponRuntime.weaponRef;
				mount.weapon = getWeaponPreset(weaponRuntime.weaponRef);
			}
		}
	}

	return merged;
}

/**
 * 批量合并舰船运行时状态
 *
 * @param runtimeStates 运行时状态数组
 */
export function mergeShipRuntimeBatch(
	runtimeStates: Array<{
		id: string;
		presetRef: string;
		customName?: string;
		transform: { x: number; y: number; heading: number };
		hull: { current: number };
		armor: { quadrants: number[] };
		flux: { soft: number; hard: number; overloaded?: boolean; overloadTime?: number };
		shield: { active: boolean; current?: number; orientation?: number };
		weapons: Map<string, any>;
		movePhase: string;
		phaseUsage?: any;
		hasMoved?: boolean;
		hasFired?: boolean;
		faction: string;
		ownerId?: string;
	}>
): Map<string, ShipJSON> {
	const result = new Map<string, ShipJSON>();

	for (const runtime of runtimeStates) {
		const merged = mergeShipRuntime(runtime.presetRef, runtime);
		if (merged) {
			result.set(merged.$id, merged);
		}
	}

	return result;
}

/**
 * 获取缓存状态
 */
export function getCacheStatus(): {
	loaded: boolean;
	loading: boolean;
	error?: string;
	ships: number;
	weapons: number;
} {
	return {
		loaded: cache.loaded,
		loading: cache.loading,
		error: cache.error,
		ships: cache.ships.size,
		weapons: cache.weapons.size,
	};
}

/**
 * 清空缓存（用于重新加载）
 */
export function clearCache(): void {
	cache.ships.clear();
	cache.weapons.clear();
	cache.loaded = false;
	cache.error = undefined;
	console.log("[PresetCache] Cache cleared");
}

/**
 * 热重载预设（用于开发调试）
 */
export async function reloadPresets(): Promise<{
	ships: number;
	weapons: number;
}> {
	clearCache();
	return preloadPresets();
}