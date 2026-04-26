/**
 * useTargets - 获取可用目标列表
 * 从 useGameStore 获取所有非己方、非摧毁的舰船
 */

import { useMemo } from "react";
import { useGameTokens } from "@/state/stores/gameStore";
import type { CombatToken } from "@vt/data";

interface TargetInfo {
	id: string;
	name: string;
}

export function useTargets(excludeShipId: string | null): TargetInfo[] {
	const tokens = useGameTokens();
	
	return useMemo(() => {
		const targets: TargetInfo[] = [];
		for (const token of Object.values(tokens) as CombatToken[]) {
			if (token.$id === excludeShipId) continue;
			if (token.runtime?.destroyed) continue;
			targets.push({
				id: token.$id,
				name: token.metadata?.name ?? token.$id.slice(-6),
			});
		}
		return targets;
	}, [excludeShipId, tokens]);
}

export default useTargets;