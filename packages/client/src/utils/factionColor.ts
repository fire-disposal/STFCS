/**
 * 从 faction ID 获取主题色（从游戏状态 factions 记录查询）
 * 回退到硬编码的预设颜色
 */
export function getFactionColor(
	factionId: string | undefined,
	factions?: Record<string, { color: string }>
): number {
	if (!factionId) return 0x888888;
	if (factions?.[factionId]) {
		return parseInt(factions[factionId].color.replace("#", ""), 16);
	}
	if (factionId.includes("fate-grip")) return 0xff4a4a;
	if (factionId.includes("player-alliance")) return 0x4a9eff;
	return 0x888888;
}
