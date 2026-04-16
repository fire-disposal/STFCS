/**
 * 武器面板模块
 * 四列布局：武器列表 | 武器信息 | 目标列表 | 开火按钮
 *
 * 武器状态机支持：
 * - READY: 就绪，可开火
 * - COOLDOWN: 冷却中，显示进度
 * - OUT_OF_AMMO: 弹药耗尽，显示装填进度
 * - DISABLED: 武器禁用
 */

import type { TargetAttackabilityType } from "@/state/stores";
import { calculateTargetAttackability, useFireModeStore } from "@/state/stores/fireModeStore";
import { GameClient } from "@/sync/GameClient";
import type { WeaponSlot, WeaponStateValue } from "@/sync/types";
import { WeaponState } from "@/sync/types";
import { notify } from "@/ui/shared/Notification";
import { Bomb, CheckCircle, Crosshair, Loader2, Swords, XCircle } from "lucide-react";
import React, { useMemo, useCallback, useEffect, useState, useRef } from "react";
import type { WeaponPanelProps } from "./types";
import { DAMAGE_TYPE_COLORS } from "./types";
import "./WeaponPanel.css";

/** 武器状态详情 */
interface WeaponStatusDetail {
	canFire: boolean;
	state: WeaponStateValue;
	stateLabel: string;
	reason?: string;
	/** 冷却进度 (0-100) */
	cooldownProgress?: number;
	/** 装填进度 (0-100) */
	reloadProgress?: number;
}

/** 获取武器状态详情 */
function getWeaponStatusDetail(ship: any, weapon: WeaponSlot): WeaponStatusDetail {
	// 舰船过载
	if (ship.isOverloaded) {
		return { canFire: false, state: weapon.state, stateLabel: "过载", reason: "舰船过载" };
	}

	// 武器禁用
	if (weapon.state === WeaponState.DISABLED) {
		return {
			canFire: false,
			state: WeaponState.DISABLED,
			stateLabel: "禁用",
			reason: "武器已禁用",
		};
	}

	// 冷却中
	if (weapon.state === WeaponState.COOLDOWN || weapon.cooldownRemaining > 0) {
		const cooldownMax = weapon.cooldownMax || 1;
		const progress = Math.max(
			0,
			Math.min(100, ((cooldownMax - weapon.cooldownRemaining) / cooldownMax) * 100)
		);
		return {
			canFire: false,
			state: WeaponState.COOLDOWN,
			stateLabel: "冷却",
			reason: `冷却中 (${Math.round(weapon.cooldownRemaining)}s)`,
			cooldownProgress: progress,
		};
	}

	// 弹药耗尽 / 装填中
	if (weapon.state === WeaponState.OUT_OF_AMMO || (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0)) {
		const reloadProgress = weapon.reloadProgress || 0;
		const progress = Math.max(0, Math.min(100, (reloadProgress / (weapon.reloadTime || 1)) * 100));
		return {
			canFire: false,
			state: WeaponState.OUT_OF_AMMO,
			stateLabel: "装填",
			reason: weapon.maxAmmo > 0 ? "弹药耗尽" : "弹药耗尽",
			reloadProgress: progress,
		};
	}

	// 武器状态不是就绪
	if (weapon.state !== WeaponState.READY) {
		return { canFire: false, state: weapon.state, stateLabel: "异常", reason: "武器状态异常" };
	}

	// 本回合已射击
	if (weapon.hasFiredThisTurn) {
		return {
			canFire: false,
			state: WeaponState.READY,
			stateLabel: "已射击",
		};
	}

	// 弹药不足（未耗尽但不足以连发）
	if (weapon.maxAmmo > 0 && weapon.currentAmmo < (weapon.burstSize || 1)) {
		return {
			canFire: false,
			state: WeaponState.READY,
			stateLabel: "弹药不足",
			reason: `弹药不足 (${weapon.currentAmmo}/${weapon.burstSize || 1})`,
		};
	}

	// 就绪
	return { canFire: true, state: WeaponState.READY, stateLabel: "就绪" };
}

export const WeaponPanel: React.FC<WeaponPanelProps> = ({
	ship,
	ships,
	disabled,
	networkManager,
}) => {
	// 渲染器状态
	const setSelectedWeapon = useFireModeStore((state) => state.setSelectedWeapon);
	const clearSelectedWeapon = useFireModeStore((state) => state.clearSelectedWeapon);
	const setSelectedTargets = useFireModeStore((state) => state.setSelectedTargets);
	const startFiring = useFireModeStore((state) => state.startFiring);
	const endFiring = useFireModeStore((state) => state.endFiring);
	const fireError = useFireModeStore((state) => state.fireError);
	const clearError = useFireModeStore((state) => state.clearError);
	const selectedTargetIds = useFireModeStore((state) => state.selectedTargetIds);

	// 面板状态
	const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);
	const [isFiringWeapon, setIsFiringWeapon] = useState(false);

	// GameClient
	const gameClientRef = useRef<GameClient | null>(null);
	useEffect(() => {
		const room = networkManager.getCurrentRoom();
		if (room) {
			gameClientRef.current = new GameClient(room);
		}
	}, [networkManager]);

	// 显示错误通知
	useEffect(() => {
		if (fireError) {
			notify.error(fireError);
			clearError();
		}
	}, [fireError, clearError]);

	// 获取武器列表
	const weapons = useMemo(() => {
		if (!ship) return [];
		const result: WeaponSlot[] = [];
		ship.weapons.forEach((weapon) => result.push(weapon));
		return result;
	}, [ship]);

	// 默认选中第一个武器
	useEffect(() => {
		if (weapons.length > 0 && !selectedWeaponId) {
			const firstWeapon = weapons[0];
			setSelectedWeaponId(firstWeapon.mountId);
			setSelectedWeapon(ship, firstWeapon, ships);
		}
	}, [weapons, selectedWeaponId, ship, ships, setSelectedWeapon]);

	// 获取选中的武器
	const selectedWeapon = useMemo(() => {
		if (!selectedWeaponId || !ship) return null;
		return weapons.find((w) => w.mountId === selectedWeaponId);
	}, [selectedWeaponId, weapons, ship]);

	// 计算可攻击目标（只显示可攻击的，不过滤友军）
	const attackableTargets = useMemo(() => {
		if (!selectedWeapon || !ship) return [];
		const targets: TargetAttackabilityType[] = [];
		ships.forEach((targetShip) => {
			if (targetShip.id === ship.id) return; // 跳过自身
			if (targetShip.isDestroyed) return; // 跳过已摧毁
			const attackability = calculateTargetAttackability(ship, selectedWeapon, targetShip);
			// 只添加可攻击的目标
			if (attackability.canAttack) {
				targets.push(attackability);
			}
		});
		return targets.sort((a, b) => a.distance - b.distance);
	}, [selectedWeapon, ship, ships]);

	// 切换选中武器
	const handleSelectWeapon = useCallback(
		(weapon: WeaponSlot) => {
			setSelectedWeaponId(weapon.mountId);
			setSelectedTargets([]);
			setSelectedWeapon(ship, weapon, ships);
		},
		[ship, ships, setSelectedWeapon, setSelectedTargets]
	);

	// 选择目标（支持多选）
	const handleSelectTarget = useCallback(
		(targetId: string) => {
			const currentIds = selectedTargetIds || [];
			const isSelected = currentIds.includes(targetId);

			if (isSelected) {
				// 取消选择
				const newIds = currentIds.filter((id) => id !== targetId);
				setSelectedTargets(newIds);
			} else {
				// 添加选择
				const newIds = [...currentIds, targetId];
				setSelectedTargets(newIds);
			}
		},
		[selectedTargetIds, setSelectedTargets]
	);

	// 执行开火
	const handleFire = useCallback(async () => {
		if (!ship || !selectedWeaponId || selectedTargetIds.length === 0 || !gameClientRef.current)
			return;

		setIsFiringWeapon(true);
		startFiring();

		try {
			// 对每个目标发送开火命令
			for (const targetId of selectedTargetIds) {
				gameClientRef.current.sendFireWeapon({
					attackerId: ship.id,
					weaponId: selectedWeaponId,
					targetId: targetId,
				});
			}

			notify.success(`开火命令已发送 (${selectedTargetIds.length}个目标)`);
			endFiring();
			setIsFiringWeapon(false);
			setSelectedTargets([]);
		} catch (error: any) {
			endFiring(error.message || "开火失败");
			setIsFiringWeapon(false);
		}
	}, [ship, selectedWeaponId, selectedTargetIds, startFiring, endFiring, setSelectedTargets]);

	// 清除渲染器状态（舰船切换时）
	useEffect(() => {
		if (!ship) {
			clearSelectedWeapon();
			setSelectedWeaponId(null);
			setSelectedTargets([]);
		}
	}, [ship, clearSelectedWeapon, setSelectedTargets]);

	// 计算选中武器的状态详情
	const weaponStatusDetail = useMemo(() => {
		if (!selectedWeapon || !ship) return null;
		return getWeaponStatusDetail(ship, selectedWeapon);
	}, [selectedWeapon, ship]);

	if (!ship || weapons.length === 0) {
		return (
			<div className="weapon-panel weapon-panel--empty">
				<div className="weapon-col weapon-col--list">
					<div className="weapon-col__header">
						<Crosshair className="weapon-col__header-icon" />
						<span>武器</span>
					</div>
					<div className="weapon-col__empty">无武器</div>
				</div>
			</div>
		);
	}

	return (
		<div className="weapon-panel">
			{/* 列1：武器列表 */}
			<div className="weapon-col weapon-col--list">
				<div className="weapon-col__header">
					<Crosshair className="weapon-col__header-icon" />
					<span>武器</span>
				</div>
				<div className="weapon-col__content">
					{weapons.map((weapon, idx) => {
						const statusDetail = getWeaponStatusDetail(ship, weapon);
						const hasFired = weapon.hasFiredThisTurn;
						const isSelected = selectedWeaponId === weapon.mountId;

						// 计算射程内是否有可攻击目标（不过滤友军）
						let hasTargetInRange = false;
						if (statusDetail.canFire && ship) {
							for (const [, targetShip] of ships) {
								if (targetShip.id === ship.id) continue;
								if (targetShip.isDestroyed) continue;
								const attackability = calculateTargetAttackability(ship, weapon, targetShip);
								if (attackability.canAttack) {
									hasTargetInRange = true;
									break;
								}
							}
						}

						// 指示灯颜色逻辑：红(不能开火) > 黄(已开火) > 蓝(就绪有目标) > 绿(就绪)
						const indicatorColor = !statusDetail.canFire
							? "red"
							: hasFired
								? "yellow"
								: hasTargetInRange
									? "blue"
									: "green";

						return (
							<button
								key={weapon.mountId}
								className={`weapon-item
									${!statusDetail.canFire ? "weapon-item--blocked" : ""}
									${hasFired ? "weapon-item--fired" : ""}
									${isSelected ? "weapon-item--selected" : ""}`}
								onClick={() => handleSelectWeapon(weapon)}
								title={statusDetail.reason || weapon.name}
							>
								<span className={`weapon-indicator weapon-indicator--${indicatorColor}`} />
								<span className="weapon-item__name">
									{weapon.displayName || weapon.name || `W${idx + 1}`}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* 列2：武器信息 */}
			{selectedWeapon && (
				<div className="weapon-col weapon-col--info">
					<div className="weapon-col__header">
						<span className="weapon-info__name">
							{selectedWeapon.displayName || selectedWeapon.name}
						</span>
						<span
							className="weapon-info__type"
							style={{ color: DAMAGE_TYPE_COLORS[selectedWeapon.damageType] || "#888" }}
						>
							{selectedWeapon.damageType}
						</span>
					</div>
					<div className="weapon-col__content weapon-info__stats">
						<div className="weapon-stat-row">
							<span className="weapon-stat__label">射程</span>
							<span className="weapon-stat__value">
								{selectedWeapon.minRange > 0
									? `${selectedWeapon.minRange}-${selectedWeapon.range}`
									: selectedWeapon.range}
							</span>
						</div>
						<div className="weapon-stat-row">
							<span className="weapon-stat__label">伤害</span>
							<span className="weapon-stat__value">{selectedWeapon.damage}</span>
						</div>
						<div className="weapon-stat-row">
							<span className="weapon-stat__label">射界</span>
							<span className="weapon-stat__value">{selectedWeapon.arc}°</span>
						</div>
						<div className="weapon-stat-row">
							<span className="weapon-stat__label">辐能</span>
							<span className="weapon-stat__value">{selectedWeapon.fluxCost}</span>
						</div>
						{selectedWeapon.maxAmmo > 0 && (
							<div className="weapon-stat-row">
								<span className="weapon-stat__label">弹药</span>
								<span className="weapon-stat__value">
									{selectedWeapon.currentAmmo}/{selectedWeapon.maxAmmo}
								</span>
							</div>
						)}
					</div>
					{/* 武器状态详情 */}
					{weaponStatusDetail && (
						<div
							className={`weapon-info__status ${weaponStatusDetail.canFire ? "weapon-info__status--ready" : "weapon-info__status--blocked"}`}
						>
							{weaponStatusDetail.canFire ? (
								<CheckCircle className="weapon-info__status-icon" />
							) : (
								<XCircle className="weapon-info__status-icon" />
							)}
							<span className="weapon-info__status-label">{weaponStatusDetail.stateLabel}</span>
							{weaponStatusDetail.reason && !weaponStatusDetail.canFire && (
								<span className="weapon-info__status-reason">{weaponStatusDetail.reason}</span>
							)}
							{/* 冷却进度条 */}
							{weaponStatusDetail.cooldownProgress !== undefined && (
								<div className="weapon-info__progress">
									<div
										className="weapon-info__progress-bar weapon-info__progress-bar--cooldown"
										style={{ width: `${weaponStatusDetail.cooldownProgress}%` }}
									/>
								</div>
							)}
							{/* 装填进度条 */}
							{weaponStatusDetail.reloadProgress !== undefined && (
								<div className="weapon-info__progress">
									<div
										className="weapon-info__progress-bar weapon-info__progress-bar--reload"
										style={{ width: `${weaponStatusDetail.reloadProgress}%` }}
									/>
								</div>
							)}
						</div>
					)}
				</div>
			)}

			{/* 列3：目标列表 */}
			<div className="weapon-col weapon-col--targets">
				<div className="weapon-col__header">
					<Swords className="weapon-col__header-icon" />
					<span>目标</span>
					{selectedTargetIds.length > 0 && (
						<span className="target-count">{selectedTargetIds.length}</span>
					)}
				</div>
				<div className="weapon-col__content target-list">
					{attackableTargets.length === 0 && selectedWeapon && (
						<div className="target-list__empty">无可用目标</div>
					)}
					{!selectedWeapon && <div className="target-list__empty">选择武器</div>}
					{attackableTargets.map((target) => {
						const targetShip = ships.get(target.shipId);
						const isSelected = selectedTargetIds?.includes(target.shipId);
						const isFriendly = target.isFriendly;
						return (
							<button
								key={target.shipId}
								className={`target-item
									${isSelected ? "target-item--selected" : ""}
									${isFriendly ? "target-item--friendly" : ""}`}
								onClick={() => handleSelectTarget(target.shipId)}
								title={isFriendly ? "⚠ 友军目标 - 可能造成误伤" : undefined}
							>
								<span className="target-item__check">
									{isSelected ? (
										<CheckCircle className="target-item__check-icon" />
									) : (
										<span className="target-item__check-placeholder" />
									)}
								</span>
								<span className="target-item__name">
									{targetShip?.name || target.shipId.slice(-8)}
									{isFriendly && <span className="target-item__tag">友军</span>}
								</span>
								<span className="target-item__dist">{Math.round(target.distance)}</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* 列4：开火按钮 */}
			<div className="weapon-col weapon-col--fire">
				<button
					className={`fire-btn ${!weaponStatusDetail?.canFire ? "fire-btn--locked" : ""}`}
					onClick={handleFire}
					disabled={
						selectedTargetIds.length === 0 || isFiringWeapon || !weaponStatusDetail?.canFire
					}
				>
					{weaponStatusDetail?.canFire ? (
						<Bomb className="fire-btn__icon" />
					) : (
						<Loader2 className="fire-btn__icon fire-btn__icon--spin" />
					)}
					<span className="fire-btn__text">
						{isFiringWeapon
							? "开火中..."
							: weaponStatusDetail?.canFire
								? "开火"
								: weaponStatusDetail?.stateLabel || "锁定"}
					</span>
					{selectedTargetIds.length > 0 && !isFiringWeapon && weaponStatusDetail?.canFire && (
						<span className="fire-btn__count">×{selectedTargetIds.length}</span>
					)}
				</button>
			</div>
		</div>
	);
};

export default WeaponPanel;
