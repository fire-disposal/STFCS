import { getGameState } from "@/state/stores/gameStore";

export function getFactionColor(
	factionId: string | undefined,
	factions?: Record<string, { color: string }>
): number {
	if (!factionId) return 0x888888;
	const record = factions ?? getGameState()?.factions;
	if (record?.[factionId]) {
		return parseInt(record[factionId].color.replace("#", ""), 16);
	}
	if (factionId.includes("fate-grip")) return 0xff4a4a;
	if (factionId.includes("player-alliance")) return 0x4a9eff;
	return 0x888888;
}
