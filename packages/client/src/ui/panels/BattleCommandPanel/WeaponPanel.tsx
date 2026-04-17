/**
 * 武器面板模块
 * 四列布局：武器列表 | 武器信息 | 目标列表 | 开火按钮
 *
 * 交互流程：
 * 1. 选中舰船 → 批量查询所有武器的可攻击目标（服务端权威）
 * 2. 选中武器 → 切换显示该武器的目标列表
 * 3. 选择目标 → 点击开火
 *
 * ⚠️ 目标可攻击性数据由服务端权威计算
 */

import type {
	TargetAttackabilityType,
	AttackableTargetsResult,
	AllAttackableTargetsResult,
} from "@/state/stores";
import { useFireModeStore } from "@/state/stores/fireModeStore";
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
	cooldownProgress?: number;
	reloadProgress?: number;
}

function getWeaponStatusDetail(ship: any, weapon: WeaponSlot): WeaponStatusDetail {
	if (ship.isOverloaded) {
		return { canFire: false, state: weapon.state, stateLabel: "过载", reason: "舰船过载" };
	}
	if (weapon.state === WeaponState.DISABLED) {
		return { canFire: false, state: WeaponState.DISABLED, stateLabel: "禁用", reason: "武器已禁用" };
	}
	if (weapon.state === WeaponState.COOLDOWN || weapon.cooldownRemaining > 0) {
		const cooldownMax = weapon.cooldownMax || 1;
		const progress = Math.max(0, Math.min(100, ((cooldownMax - weapon.cooldownRemaining) / cooldownMax) * 100));
		return { canFire: false, state: WeaponState.COOLDOWN, stateLabel: "冷却", reason: `冷却中 (${Math.round(weapon.cooldownRemaining)}s)`, cooldownProgress: progress };
	}
	if (weapon.state === WeaponState.OUT_OF_AMMO || (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0)) {
		const reloadProgress = weapon.reloadProgress || 0;
		const progress = Math.max(0, Math.min(100, (reloadProgress / (weapon.reloadTime || 1)) * 100));
		return { canFire: false, state: WeaponState.OUT_OF_AMMO, stateLabel: "装填", reason: "弹药耗尽", reloadProgress: progress };
	}
	if (weapon.state !== WeaponState.READY) {
		return { canFire: false, state: weapon.state, stateLabel: "异常", reason: "武器状态异常" };
	}
	if (weapon.hasFiredThisTurn) {
		return { canFire: false, state: WeaponState.READY, stateLabel: "已射击" };
	}
	if (weapon.maxAmmo > 0 && weapon.currentAmmo < (weapon.burstSize || 1)) {
		return { canFire: false, state: WeaponState.READY, stateLabel: "弹药不足", reason: `弹药不足 (${weapon.currentAmmo}/${weapon.burstSize || 1})` };
	}
	return { canFire: true, state: WeaponState.READY, stateLabel: "就绪" };
}

export const WeaponPanel: React.FC<WeaponPanelProps> = ({ ship, ships, disabled, networkManager }) => {
	// Store 状态
	const selectedWeapon = useFireModeStore((s) => s.selectedWeapon);
	const weaponsTargets = useFireModeStore((s) => s.weaponsTargets);
	const attackableTargets = useFireModeStore((s) => s.attackableTargets);
	const weaponCanFire = useFireModeStore((s) => s.weaponCanFire);
	const weaponFireReason = useFireModeStore((s) => s.weaponFireReason);
	const selectedTargetIds = useFireModeStore((s) => s.selectedTargetIds);
	const isLoading = useFireModeStore((s) => s.isLoading);
	const fireError = useFireModeStore((s) => s.fireError);

	// Store actions
	const selectShip = useFireModeStore((s) => s.selectShip);
	const selectWeapon = useFireModeStore((s) => s.selectWeapon);
	const setAllAttackableTargetsFromServer = useFireModeStore((s) => s.setAllAttackableTargetsFromServer);
	const setAttackableTargetsFromServer = useFireModeStore((s) => s.setAttackableTargetsFromServer);
	const setSelectedTargets = useFireModeStore((s) => s.setSelectedTargets);
	const startFiring = useFireModeStore((s) => s.startFiring);
	const endFiring = useFireModeStore((s) => s.endFiring);
	const clearSelection = useFireModeStore((s) => s.clearSelection);
	const clearError = useFireModeStore((s) => s.clearError);

	// 面板状态
	const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);

	// GameClient
	const gameClientRef = useRef<GameClient | null>(null);
	useEffect(() => {
		const room = networkManager.getCurrentRoom();
		if (room) gameClientRef.current = new GameClient(room);
	}, [networkManager]);

	// 监听批量查询结果
	useEffect(() => {
		const handler = (e: CustomEvent<AllAttackableTargetsResult>) => setAllAttackableTargetsFromServer(e.detail);
		window.addEventListener("stfcs-all-attackable-targets", handler as EventListener);
		return () => window.removeEventListener("stfcs-all-attackable-targets", handler as EventListener);
	}, [setAllAttackableTargetsFromServer]);

	// 监听单武器查询结果
	useEffect(() => {
		const handler = (e: CustomEvent<AttackableTargetsResult>) => setAttackableTargetsFromServer(e.detail);
		window.addEventListener("stfcs-attackable-targets", handler as EventListener);
		return () => window.removeEventListener("stfcs-attackable-targets", handler as EventListener);
	}, [setAttackableTargetsFromServer]);

	// 错误通知
	useEffect(() => {
		if (fireError) { notify.error(fireError); clearError(); }
	}, [fireError, clearError]);

	// 获取武器列表
	const weapons = useMemo(() => {
		if (!ship) return [];
		const result: WeaponSlot[] = [];
		ship.weapons.forEach((w) => result.push(w));
		return result;
	}, [ship]);

	// 选中舰船时触发批量查询
	useEffect(() => {
		if (ship) {
			const room = networkManager.getCurrentRoom();
			if (room) selectShip(ship, room);
			// 默认选中第一个武器
			if (weapons.length > 0 && !selectedWeaponId) {
				setSelectedWeaponId(weapons[0].mountId);
				selectWeapon(weapons[0]);
			}
		} else {
			clearSelection();
			setSelectedWeaponId(null);
		}
	}, [ship, networkManager, selectShip, clearSelection, weapons, selectedWeaponId, selectWeapon]);

	// 当前选中武器
	const currentWeapon = useMemo(() => {
		if (!selectedWeaponId || !ship) return null;
		return weapons.find((w) => w.mountId === selectedWeaponId);
	}, [selectedWeaponId, weapons, ship]);

	// 切换武器
	const handleSelectWeapon = useCallback((weapon: WeaponSlot) => {
		setSelectedWeaponId(weapon.mountId);
		setSelectedTargets([]);
		selectWeapon(weapon);
	}, [setSelectedTargets, selectWeapon]);

	// 选择目标
	const handleSelectTarget = useCallback((targetId: string) => {
		const current = selectedTargetIds || [];
		if (current.includes(targetId)) {
			setSelectedTargets(current.filter((id) => id !== targetId));
		} else {
			setSelectedTargets([...current, targetId]);
		}
	}, [selectedTargetIds, setSelectedTargets]);

	// 开火
	const handleFire = useCallback(async () => {
		if (!ship || !selectedWeaponId || selectedTargetIds.length === 0 || !gameClientRef.current) return;
		startFiring();
		try {
			for (const targetId of selectedTargetIds) {
				gameClientRef.current.sendFireWeapon({ attackerId: ship.id, weaponId: selectedWeaponId, targetId });
			}
			notify.success(`开火命令已发送 (${selectedTargetIds.length}个目标)`);
			endFiring();
			setSelectedTargets([]);
		} catch (err: any) {
			endFiring(err.message || "开火失败");
		}
	}, [ship, selectedWeaponId, selectedTargetIds, startFiring, endFiring, setSelectedTargets]);

	// 武器状态详情
	const weaponStatusDetail = useMemo(() => {
		if (!currentWeapon || !ship) return null;
		return getWeaponStatusDetail(ship, currentWeapon);
	}, [currentWeapon, ship]);

	if (!ship || weapons.length === 0) {
		return (
			<div className="weapon-panel weapon-panel--empty">
				<div className="weapon-col weapon-col--list">
					<div className="weapon-col__header"><Crosshair className="weapon-col__header-icon" /><span>武器</span></div>
					<div className="weapon-col__empty">无武器</div>
				</div>
			</div>
		);
	}

	return (
		<div className="weapon-panel">
			{/* 列1：武器列表 */}
			<div className="weapon-col weapon-col--list">
				<div className="weapon-col__header"><Crosshair className="weapon-col__header-icon" /><span>武器</span></div>
				<div className="weapon-col__content">
					{weapons.map((weapon, idx) => {
						const statusDetail = getWeaponStatusDetail(ship, weapon);
						const hasFired = weapon.hasFiredThisTurn;
						const isSelected = selectedWeaponId === weapon.mountId;

						// 从批量查询结果判断是否有可攻击目标
						const weaponResult = weaponsTargets.get(weapon.instanceId);
						const hasAttackableTargets = weaponResult?.targets.some((t) => t.canAttack) ?? false;

						// 指示灯：红(不能开火) > 黄(已开火) > 蓝(就绪有目标) > 绿(就绪)
						const indicatorColor = !statusDetail.canFire
							? "red"
							: hasFired
								? "yellow"
								: hasAttackableTargets
									? "blue"
									: "green";

						return (
							<button
								key={weapon.mountId}
								className={`weapon-item ${!statusDetail.canFire ? "weapon-item--blocked" : ""} ${hasFired ? "weapon-item--fired" : ""} ${isSelected ? "weapon-item--selected" : ""}`}
								onClick={() => handleSelectWeapon(weapon)}
								title={statusDetail.reason || weapon.name}
							>
								<span className={`weapon-indicator weapon-indicator--${indicatorColor}`} />
								<span className="weapon-item__name">{weapon.displayName || weapon.name || `W${idx + 1}`}</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* 列2：武器信息 */}
			{currentWeapon && (
				<div className="weapon-col weapon-col--info">
					<div className="weapon-col__header">
						<span className="weapon-info__name">{currentWeapon.displayName || currentWeapon.name}</span>
						<span className="weapon-info__type" style={{ color: DAMAGE_TYPE_COLORS[currentWeapon.damageType] || "#888" }}>{currentWeapon.damageType}</span>
					</div>
					<div className="weapon-col__content weapon-info__stats">
						<div className="weapon-stat-row"><span className="weapon-stat__label">射程</span><span className="weapon-stat__value">{currentWeapon.minRange > 0 ? `${currentWeapon.minRange}-${currentWeapon.range}` : currentWeapon.range}</span></div>
						<div className="weapon-stat-row"><span className="weapon-stat__label">伤害</span><span className="weapon-stat__value">{currentWeapon.damage}</span></div>
						<div className="weapon-stat-row"><span className="weapon-stat__label">射界</span><span className="weapon-stat__value">{currentWeapon.mountType === "HARDPOINT" ? (currentWeapon.hardpointArc || 20) : (currentWeapon.arc || 180)}°</span></div>
						<div className="weapon-stat-row"><span className="weapon-stat__label">辐能</span><span className="weapon-stat__value">{currentWeapon.fluxCost}</span></div>
						{currentWeapon.maxAmmo > 0 && <div className="weapon-stat-row"><span className="weapon-stat__label">弹药</span><span className="weapon-stat__value">{currentWeapon.currentAmmo}/{currentWeapon.maxAmmo}</span></div>}
					</div>
					{weaponStatusDetail && (
						<div className={`weapon-info__status ${weaponStatusDetail.canFire ? "weapon-info__status--ready" : "weapon-info__status--blocked"}`}>
							{weaponStatusDetail.canFire ? <CheckCircle className="weapon-info__status-icon" /> : <XCircle className="weapon-info__status-icon" />}
							<span className="weapon-info__status-label">{weaponStatusDetail.stateLabel}</span>
							{weaponStatusDetail.reason && !weaponStatusDetail.canFire && <span className="weapon-info__status-reason">{weaponStatusDetail.reason}</span>}
							{weaponStatusDetail.cooldownProgress !== undefined && <div className="weapon-info__progress"><div className="weapon-info__progress-bar weapon-info__progress-bar--cooldown" style={{ width: `${weaponStatusDetail.cooldownProgress}%` }} /></div>}
							{weaponStatusDetail.reloadProgress !== undefined && <div className="weapon-info__progress"><div className="weapon-info__progress-bar weapon-info__progress-bar--reload" style={{ width: `${weaponStatusDetail.reloadProgress}%` }} /></div>}
						</div>
					)}
				</div>
			)}

			{/* 列3：目标列表 */}
			<div className="weapon-col weapon-col--targets">
				<div className="weapon-col__header"><Swords className="weapon-col__header-icon" /><span>目标</span>{selectedTargetIds.length > 0 && <span className="target-count">{selectedTargetIds.length}</span>}</div>
				<div className="weapon-col__content target-list">
					{isLoading && <div className="target-list__loading"><Loader2 className="target-list__loading-icon" /></div>}
					{!isLoading && attackableTargets.length === 0 && currentWeapon && <div className="target-list__empty">无可用目标</div>}
					{!currentWeapon && <div className="target-list__empty">选择武器</div>}
					{!isLoading && attackableTargets.map((target) => {
						const targetShip = ships.get(target.shipId);
						const isSelected = selectedTargetIds?.includes(target.shipId);
						const isFriendly = target.isFriendly;
						return (
							<button key={target.shipId} className={`target-item ${isSelected ? "target-item--selected" : ""} ${isFriendly ? "target-item--friendly" : ""}`} onClick={() => handleSelectTarget(target.shipId)} title={isFriendly ? "⚠ 友军目标" : undefined}>
								<span className="target-item__check">{isSelected ? <CheckCircle className="target-item__check-icon" /> : <span className="target-item__check-placeholder" />}</span>
								<span className="target-item__name">{targetShip?.name || target.shipId.slice(-8)}{isFriendly && <span className="target-item__tag">友军</span>}</span>
								<span className="target-item__dist">{Math.round(target.distance)}</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* 列4：开火按钮 */}
			<div className="weapon-col weapon-col--fire">
				<button className={`fire-btn ${!weaponStatusDetail?.canFire ? "fire-btn--locked" : ""}`} onClick={handleFire} disabled={selectedTargetIds.length === 0 || !weaponStatusDetail?.canFire}>
					{weaponStatusDetail?.canFire ? <Bomb className="fire-btn__icon" /> : <Loader2 className="fire-btn__icon fire-btn__icon--spin" />}
					<span className="fire-btn__text">{weaponStatusDetail?.canFire ? "开火" : weaponStatusDetail?.stateLabel || "锁定"}</span>
					{selectedTargetIds.length > 0 && weaponStatusDetail?.canFire && <span className="fire-btn__count">×{selectedTargetIds.length}</span>}
				</button>
			</div>
		</div>
	);
};

export default WeaponPanel;