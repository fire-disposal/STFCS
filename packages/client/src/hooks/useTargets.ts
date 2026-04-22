/**
 * useTargets - 获取可用目标列表
 * 从 gameStateRef.room 获取所有非己方、非摧毁的舰船
 */

import { useMemo } from "react";
import { gameStateRef } from "@/state/stores/uiStore";

interface TargetInfo {
	id: string;
	name: string;
}

export function useTargets(excludeShipId: string | null): TargetInfo[] {
	return useMemo(() => {
		const room = gameStateRef.room;
		if (!room?.state?.tokens) return [];

		const targets: TargetInfo[] = [];
		for (const token of Object.values(room.state.tokens)) {
			const t = token as any;
			if (t.$id === excludeShipId) continue;
			if (t.runtime?.destroyed) continue;
			targets.push({
				id: t.$id,
				name: t.metadata?.name ?? t.$id.slice(-6),
			});
		}
		return targets;
	}, [excludeShipId, gameStateRef.room?.state?.tokens]);
}

export default useTargets;