import { GAME_CONFIG, WeaponState } from "@vt/data";
import { computePhaseTransition } from "@vt/rules";
import type { GameRoomState, PlayerState } from "../../schema/GameSchema.js";
import { ShipState, WeaponSlot } from "../../schema/ShipStateSchema.js";
import { toPhaseChangeDto } from "../../dto/index.js";

/**
 * 推进游戏阶段
 */
export function handleAdvancePhase(
	state: GameRoomState,
	broadcast: (type: string, data: unknown) => void
): void {
	const { nextPhase, activeFaction, shouldProcessEndPhase } = computePhaseTransition(state.currentPhase);

	state.currentPhase = nextPhase;
	
	// 重置所有玩家准备状态
	state.players.forEach((p: PlayerState) => (p.isReady = false));

	// END_PHASE 模式：处理回合结算并自动递归进入下一阶段（通常是回到下一回合的起始阶段）
	if (shouldProcessEndPhase) {
		processEndPhase(state);
		return handleAdvancePhase(state, broadcast);
	}

	state.activeFaction = activeFaction;
	broadcast("phase_change", toPhaseChangeDto(state.currentPhase, state.turnCount));
}

/**
 * 处理回合结束时的逻辑结算（核心业务逻辑）
 */
function processEndPhase(state: GameRoomState): void {
	state.ships.forEach((ship: ShipState) => {
		if (ship.isDestroyed) return;

		// 将各系统结算逻辑解耦为独立的领域函数
		resetShipActionState(ship);
		handleWeaponMaintenance(ship);
		handleFluxAndSystems(ship);
	});

	// 回合计数递增
	state.turnCount++;
}

/** 重置舰船每回合的行动限制 */
function resetShipActionState(ship: ShipState): void {
	ship.hasMoved = false;
	ship.hasFired = false;
	ship.movePhase = "PHASE_A";
	ship.phaseAForwardUsed = 0;
	ship.phaseAStrafeUsed = 0;
	ship.phaseTurnUsed = 0;
	ship.phaseCForwardUsed = 0;
	ship.phaseCStrafeUsed = 0;
}

/** 
 * 武器系统维护流程
 * 领域：WEAPON_SYSTEMS
 */
function handleWeaponMaintenance(ship: ShipState): void {
	ship.weapons.forEach((w: WeaponSlot) => {
		w.hasFiredThisTurn = false;
		w.resetBurst();

		// 1. 冷却检查
		if (w.state === WeaponState.COOLDOWN && w.cooldownRemaining <= 0) {
			w.state = (w.maxAmmo > 0 && w.currentAmmo <= 0) ? WeaponState.OUT_OF_AMMO : WeaponState.READY;
		}

		// 2. 弹药装填
		if (w.state === WeaponState.OUT_OF_AMMO && w.maxAmmo > 0) {
			w.reloadProgress += GAME_CONFIG.TURN_DURATION_SECONDS;
			if (w.reloadProgress >= w.reloadTime || w.reloadTime === 0) {
				w.currentAmmo = w.maxAmmo;
				w.reloadProgress = 0;
				w.state = WeaponState.READY;
			}
		}

		// 3. 结构性恢复（排散导致的功能恢复）
		if (w.state === WeaponState.DISABLED && ship.flux.state === "VENTING") {
			w.state = (w.maxAmmo > 0 && w.currentAmmo <= 0) ? WeaponState.OUT_OF_AMMO : WeaponState.READY;
		}
	});
}

/** 
 * 辐能、护盾与系统状态处理
 * 领域：FLUX_CORE / SYSTEMS
 */
function handleFluxAndSystems(ship: ShipState): void {
	// 1. 排散状态优先级（直接清空所有辐能）
	if (ship.flux.state === "VENTING") {
		ship.flux.soft = 0;
		ship.flux.hard = 0;
		ship.flux.state = "NORMAL";
		return; // 排散期间跳过散逸和过载自愈
	}

	// 2. 护盾维持消耗（增加软辐能）
	if (ship.shield.active) {
		const shieldUpCost = GAME_CONFIG.SHIELD_UP_FLUX_COST || ship.flux.dissipation * 0.2;
		ship.flux.addSoft(shieldUpCost);
	}

	// 3. 散逸逻辑（非过载状态）
	if (!ship.isOverloaded) {
		ship.flux.dissipate(1.0); 
	}

	// 4. 过载逻辑
	handleOverloadLogic(ship);
}

/** 过载特定状态机 */
function handleOverloadLogic(ship: ShipState): void {
	// 检查并触发新过载（如果软/硬辐能总和超过最大值，Schema 层通常已处理，这里同步状态）
	if (ship.flux.isOverloaded && !ship.isOverloaded) {
		ship.isOverloaded = true;
		ship.overloadTime = GAME_CONFIG.OVERLOAD_BASE_DURATION;
		ship.shield.deactivate();
	}

	// 过载时间推进与恢复
	if (ship.isOverloaded) {
		ship.overloadTime -= GAME_CONFIG.TURN_DURATION_SECONDS;
		if (ship.overloadTime <= 0) {
			ship.isOverloaded = false;
			// 过载后惩罚：保留 50% 的辐能（软硬比例维持）
			const halfFlux = ship.flux.max / 2;
			if (ship.flux.total > halfFlux) {
				const ratio = halfFlux / ship.flux.total;
				ship.flux.soft *= ratio;
				ship.flux.hard *= ratio;
			}
		}
	}
}
