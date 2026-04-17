/**
 * 查询处理器
 *
 * 处理火控查询请求，结果写入 Schema 直接同步
 */

import type { Client } from "@colyseus/core";
import { handleQueryAllAttackableTargets } from "./queryTargetHandler.js";
import type { GameRoomState } from "../../schema/GameSchema.js";

/**
 * 处理舰船所有武器的可攻击目标批量查询
 *
 * 结果直接写入 fireControlCache Schema，自动同步到客户端
 * 无需发送消息，客户端通过 Schema 订阅获取数据
 */
export function handleGetAllAttackableTargets(
	state: GameRoomState,
	client: Client,
	payload: { shipId: string }
): void {
	handleQueryAllAttackableTargets(state, client, payload);
}