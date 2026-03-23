import type { ShipAssetDefinition } from "@vt/shared/types";

const STARTER_ASSETS: ShipAssetDefinition[] = [
	{
		id: "wolf_starter",
		name: "Wolf (Starter)",
		hullClass: "frigate",
		manufacturer: "Tri-Tachyon",
		baseStats: {
			maxMovement: 320,
			actionsPerTurn: 1,
			size: 52,
		},
		defaultCustomization: {
			paint: "navy",
			decal: "wolf",
			nickname: "Scout-01",
			modules: [],
		},
	},
	{
		id: "hammerhead_starter",
		name: "Hammerhead (Starter)",
		hullClass: "destroyer",
		manufacturer: "Manticore Works",
		baseStats: {
			maxMovement: 260,
			actionsPerTurn: 1,
			size: 68,
		},
		defaultCustomization: {
			paint: "gray",
			decal: "hammer",
			nickname: "Vanguard-02",
			modules: [],
		},
	},
	{
		id: "enforcer_starter",
		name: "Enforcer (Starter)",
		hullClass: "destroyer",
		manufacturer: "Low Tech Yards",
		baseStats: {
			maxMovement: 220,
			actionsPerTurn: 1,
			size: 72,
		},
		defaultCustomization: {
			paint: "rust",
			decal: "enforcer",
			nickname: "Bulwark-03",
			modules: [],
		},
	},
];

export class ShipAssetLibrary {
	listAssets(): ShipAssetDefinition[] {
		return STARTER_ASSETS.map((asset) => ({ ...asset }));
	}

	getAsset(assetId: string): ShipAssetDefinition | undefined {
		return STARTER_ASSETS.find((asset) => asset.id === assetId);
	}
}

