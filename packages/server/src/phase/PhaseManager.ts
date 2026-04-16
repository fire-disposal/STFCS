/**
 * 阶段管理（服务端）
 *
 * 使用 rules/phase 纯函数计算，负责状态修改和广播
 */

import { GAME_CONFIG, WeaponState } from "@vt/data";
import { computePhaseTransition } from "@vt/rules";
import type { GameRoomState, PlayerState } from "../schema/GameSchema.js";
import { toPhaseChangeDto } from "../dto/index.js";
import { ShipState, WeaponSlot } from "../schema/ShipStateSchema.js";

/** 推进游戏阶段 */
export function advancePhase(
	state: GameRoomState,
	broadcast: (type: string, data: unknown) => void
): void {
	const { nextPhase, activeFaction, shouldProcessEndPhase } = computePhaseTransition(state.currentPhase);

	state.currentPhase = nextPhase;
	state.players.forEach((p: PlayerState) => (p.isReady = false));

	// END_PHASE 需要处理回合结算，然后自动进入下一阶段
	if (shouldProcessEndPhase) {
		processEndPhase(state);
		return advancePhase(state, broadcast);
	}

	state.activeFaction = activeFaction;
	broadcast("phase_change", toPhaseChangeDto(state.currentPhase, state.turnCount));
}

/** 处理回合结束阶段 */
function processEndPhase(state: GameRoomState): void {
	state.ships.forEach((ship: ShipState) => {
		if (ship.isDestroyed) return;

		// === 重置移动状态 ===
		ship.hasMoved = false;
		ship.hasFired = false;
		ship.movePhase = "PHASE_A";
		ship.phaseAForwardUsed = 0;
		ship.phaseAStrafeUsed = 0;
		ship.phaseTurnUsed = 0;
		ship.phaseCForwardUsed = 0;
		ship.phaseCStrafeUsed = 0;

		// === 武器状态处理 ===
		ship.weapons.forEach((w: WeaponSlot) => {
			w.hasFiredThisTurn = false;
			w.resetBurst();  // 重置连发状态

			// 冷却完成检查
			if (w.state === WeaponState.COOLDOWN && w.cooldownRemaining <= 0) {
				// 弹药耗尽则进入 OUT_OF_AMMO 状态，否则进入 READY
				if (w.maxAmmo > 0 && w.currentAmmo <= 0) {
					w.state = WeaponState.OUT_OF_AMMO;
					// 开始装填计时
					if (w.reloadTime > 0) {
						w.reloadProgress = 0;
					}
				} else {
					w.state = WeaponState.READY;
				}
			}

			// 弹药装填处理
			// 模式 A: 回合结束自动装填（简化模式）
			if (w.state === WeaponState.OUT_OF_AMMO && w.maxAmmo > 0) {
				// 对于 reloadTime <= 回合时间（约10秒）的武器，回合结束直接装填
				// 对于 reloadTime > 回合时间的武器，需要等待多回合
				if (w.reloadTime <= GAME_CONFIG.TURN_DURATION_SECONDS || w.reloadTime === 0) {
					w.currentAmmo = w.maxAmmo;
					w.reloadProgress = 0;
					w.state = WeaponState.READY;
				} else {
					// 累积装填进度
					w.reloadProgress += GAME_CONFIG.TURN_DURATION_SECONDS;
					if (w.reloadProgress >= w.reloadTime) {
						w.currentAmmo = w.maxAmmo;
						w.reloadProgress = 0;
						w.state = WeaponState.READY;
					}
				}
			}

			// DISABLED 状态武器不恢复（需要维修）
			if (w.state === WeaponState.DISABLED) {
				// 保持禁用状态，等待 DM 手动修复
			}
		});

		// === 护盾维持消耗辐能 ===
		if (ship.shield.active) {
			const shieldUpCost = GAME_CONFIG.SHIELD_UP_FLUX_COST || ship.flux.dissipation * 0.2;
			ship.flux.addSoft(shieldUpCost);
		}

		// === 辐能散逸 ===
		// 只有非过载状态才散逸软辐能
		if (!ship.isOverloaded) {
			ship.flux.dissipate(1.0);  // 消耗 dissipation 点数的软辐能
		}

		// === 过载处理 ===
		// 检查新过载
		if (ship.flux.isOverloaded && !ship.isOverloaded) {
			ship.isOverloaded = true;
			ship.overloadTime = GAME_CONFIG.OVERLOAD_BASE_DURATION;
			ship.shield.deactivate();
		}

		// 过载恢复
		if (ship.isOverloaded && ship.overloadTime <= 0) {
			ship.isOverloaded = false;
			// 过载恢复后辐能降至一半
			const halfFlux = ship.flux.max / 2;
			if (ship.flux.total > halfFlux) {
				ship.flux.soft = Math.min(halfFlux, ship.flux.soft);
				ship.flux.hard = Math.max(0, halfFlux - ship.flux.soft);
			}
		}

		// 过载时间递减
		if (ship.isOverloaded && ship.overloadTime > 0) {
			ship.overloadTime -= GAME_CONFIG.TURN_DURATION_SECONDS;
		}

		// === 主动排散处理 ===
		// 如果舰船处于排散状态（由 CMD_VENT_FLUX 触发）
		if (ship.flux.state === "VENTING") {
			// 排散期间不产生辐能，持续清空
			ship.flux.soft = 0;
			ship.flux.hard = 0;
			ship.flux.state = "NORMAL";
			// 排散完成后可以行动
		}
	});

	// 回合计数递增
	state.turnCount++;
}