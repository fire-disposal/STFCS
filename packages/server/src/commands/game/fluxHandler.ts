/**
 * 辐能排散命令处理器
 *
 * 设计文档要求（主动排散）：
 * - 关闭自身护盾
 * - 禁用武器直到自身回合结束
 * - 清空自身的辐能（硬辐能和软辐能）
 *
 * 约束条件：
 * - 本回合已开火则不能主动排散
 * - 过载状态不能主动排散
 */

import type { Client } from "@colyseus/core";
import { FluxState, WeaponState } from "@vt/data";
import type { GameRoomState } from "../../schema/GameSchema.js";
import { validateAuthority } from "./utils.js";

/**
 * 处理辐能主动排散命令
 *
 * 完整流程：
 * 1. 验证舰船存在和权限
 * 2. 验证舰船状态（未过载、未开火）
 * 3. 关闭护盾
 * 4. 禁用所有武器（直到回合结束）
 * 5. 设置排散状态（VENTING）
 * 6. 清空辐能
 */
export function handleVentFlux(state: GameRoomState, client: Client, payload: { shipId: string }): void {
	const ship = state.ships.get(payload.shipId);
	if (!ship) throw new Error("舰船不存在");

	// 验证权限
	validateAuthority(state, client, ship);

	// 验证舰船状态
	if (ship.isOverloaded) {
		throw new Error("舰船过载，无法主动排散");
	}

	if (ship.isDestroyed) {
		throw new Error("舰船已摧毁，无法主动排散");
	}

	// 本回合已开火则不能主动排散
	if (ship.hasFired) {
		throw new Error("本回合已开火，无法主动排散");
	}

	// === 执行主动排散 ===

	// 1. 关闭护盾
	if (ship.shield.active) {
		ship.shield.deactivate();
	}

	// 2. 禁用所有武器（设置为 DISABLED 状态，回合结束时恢复）
	ship.weapons.forEach((weapon) => {
		// 仅禁用就绪状态的武器，冷却中的武器保持原状态
		if (weapon.state === WeaponState.READY) {
			weapon.state = WeaponState.DISABLED;
		}
	});

	// 3. 设置排散状态（用于回合结束时识别）
	ship.flux.state = FluxState.VENTING;

	// 4. 清空辐能（硬辐能和软辐能都清零）
	ship.flux.hard = 0;
	ship.flux.soft = 0;
}