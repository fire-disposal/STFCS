import { WeaponJSONSchema, type WeaponJSON } from "@vt/data";
import { PlayerInfoService } from "../PlayerInfoService.js";
import { PresetService } from "../preset/PresetService.js";

let idCounter = 0;

function generateId(prefix: string): string {
	idCounter++;
	return `${prefix}:${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export class WeaponService {
	private presetService: PresetService;

	constructor(private playerInfoService: PlayerInfoService) {
		this.presetService = new PresetService();
	}

	async createWeaponBuild(ownerId: string, weaponJson: unknown): Promise<WeaponJSON> {
		const validated = WeaponJSONSchema.parse(weaponJson) as WeaponJSON;
		const weapon: WeaponJSON = validated.$id.startsWith("preset:") || validated.$id.startsWith("weapon:preset:")
			? { ...validated, $id: generateId("weapon") }
			: validated;
		return await this.playerInfoService.addWeapon(ownerId, weapon);
	}

	async createFromPreset(ownerId: string, presetId: string): Promise<WeaponJSON> {
		const preset = await this.presetService.getWeaponPresetById(presetId);
		if (!preset) throw new Error(`Preset weapon not found: ${presetId}`);
		const weapon: WeaponJSON = {
			...JSON.parse(JSON.stringify(preset)),
			$id: generateId("weapon"),
		};
		return await this.playerInfoService.addWeapon(ownerId, weapon);
	}

	async getWeaponBuild(ownerId: string, weaponId: string): Promise<WeaponJSON | null> {
		const weapons = await this.playerInfoService.getWeapons(ownerId);
		return weapons.find((w) => w.$id === weaponId) ?? null;
	}

	async getWeaponBuildsByOwner(ownerId: string): Promise<WeaponJSON[]> {
		return await this.playerInfoService.getWeapons(ownerId);
	}

	async updateWeaponBuild(ownerId: string, weaponId: string, updates: Partial<WeaponJSON>): Promise<WeaponJSON | null> {
		return await this.playerInfoService.updateWeapon(ownerId, weaponId, updates);
	}

	async deleteWeaponBuild(ownerId: string, weaponId: string): Promise<boolean> {
		return await this.playerInfoService.deleteWeapon(ownerId, weaponId);
	}

	checkWeaponCompatibility(_weaponId: string, mountSize: string): boolean {
		const sizeHierarchy: Record<string, string[]> = {
			SMALL: ["SMALL"],
			MEDIUM: ["SMALL", "MEDIUM"],
			LARGE: ["SMALL", "MEDIUM", "LARGE"],
		};
		return (sizeHierarchy[mountSize] ?? []).includes(mountSize);
	}

	calculateWeaponStats(weaponJson: WeaponJSON): { dps: number; fluxPerSecond: number; effectiveRange: number } {
		const spec = weaponJson.spec;
		const cooldown = spec.cooldown ?? 1;
		const burstCount = spec.burstCount ?? 1;
		const projectiles = spec.projectilesPerShot ?? 1;
		return {
			dps: (spec.damage * projectiles * burstCount) / cooldown,
			fluxPerSecond: spec.fluxCostPerShot / cooldown,
			effectiveRange: spec.range,
		};
	}
}