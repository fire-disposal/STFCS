import type { Client } from "@colyseus/core";
import { handleQueryAttackableTargets, handleQueryAllAttackableTargets } from "./index.js";
import type { AttackableTargetsResult } from "./index.js";
import type { GameRoomState } from "../../schema/GameSchema.js";

/**
 * 处理单个武器的可攻击目标查询
 */
export function handleGetAttackableTargets(
	state: GameRoomState,
	client: Client,
	payload: { shipId: string; weaponInstanceId: string }
): void {
	const result = handleQueryAttackableTargets(state, client, payload);
	client.send("ATTACKABLE_TARGETS_RESULT", result);
}

/**
 * 处理舰船所有武器的可攻击目标批量查询
 */
export function handleGetAllAttackableTargets(
	state: GameRoomState,
	client: Client,
	payload: { shipId: string }
): void {
	const result = handleQueryAllAttackableTargets(state, client, payload);
	
	// 转换 Map 为数组以便网络传输
	const weaponsArray: Array<{ weaponInstanceId: string; result: AttackableTargetsResult }> = [];
	result.weapons.forEach((r, weaponInstanceId) => {
		weaponsArray.push({ weaponInstanceId, result: r });
	});

	client.send("ALL_ATTACKABLE_TARGETS_RESULT", {
		shipId: result.shipId,
		weapons: weaponsArray,
	});
}
