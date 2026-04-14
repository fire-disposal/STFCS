/**
 * 舰船操作面板
 *
 * 提供舰船的核心操作按钮：
 * - 移动操作（三阶段移动）
 * - 护盾开关
 * - 武器开火
 * - 辐能排散
 * - 结束回合
 *
 * 样式: game-panels.css (action-panel 类)
 */

import type { PlayerRoleValue, ShipState, WeaponSlot } from "@vt/types";
import { ClientCommand as CC, Faction, PlayerRole, WeaponState } from "@vt/types";
import { Bomb, Check, Crosshair, Rocket, Shield, Sparkles, Wind, Zap } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";

const phaseNames: Record<string, string> = {
	DEPLOYMENT: "部署阶段",
	PLAYER_TURN: "玩家回合",
	DM_TURN: "DM回合",
	END_PHASE: "结算阶段",
};

interface ShipActionPanelProps {
	ship: ShipState | null;
	allShips: ShipState[];
	currentPhase: string;
	activeFaction?: string;
	playerRole: PlayerRoleValue;
	playerSessionId: string;
	onSendCommand: (command: (typeof CC)[keyof typeof CC], payload: Record<string, unknown>) => void;
	disabled?: boolean;
}

export const ShipActionPanel: React.FC<ShipActionPanelProps> = ({
	ship,
	allShips,
	currentPhase,
	activeFaction: _activeFaction,
	playerRole,
	playerSessionId,
	onSendCommand,
	disabled = false,
}) => {
	const [movePhaseA, setMovePhaseA] = useState(0);
	const [movePhaseAStrafe, setMovePhaseAStrafe] = useState(0);
	const [turnAngle, setTurnAngle] = useState(0);
	const [movePhaseB, setMovePhaseB] = useState(0);
	const [movePhaseBStrafe, setMovePhaseBStrafe] = useState(0);
	const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null);
	const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

	const canOperate = useMemo(() => {
		if (!ship) return false;
		if (disabled) return false;
		if (ship.isOverloaded) return false;
		if (playerRole === PlayerRole.DM) return true;
		if (ship.ownerId !== playerSessionId) return false;
		if (currentPhase !== "PLAYER_TURN") return false;
		return true;
	}, [ship, disabled, playerRole, playerSessionId, currentPhase]);

	const canMove = useMemo(() => canOperate && ship && !ship.hasMoved, [canOperate, ship]);
	const canFire = useMemo(() => canOperate && ship && !ship.hasFired, [canOperate, ship]);
	const canVent = useMemo(() => {
		if (!canOperate || !ship) return false;
		if (ship.isShieldUp) return false;
		if (ship.fluxHard + ship.fluxSoft <= 0) return false;
		return true;
	}, [canOperate, ship]);
	const canToggleShield = useMemo(() => {
		if (!canOperate || !ship) return false;
		if (ship.isOverloaded && !ship.isShieldUp) return false;
		return true;
	}, [canOperate, ship]);

	const availableWeapons = useMemo(() => {
		if (!ship) return [];
		const result: WeaponSlot[] = [];
		ship.weapons.forEach((w) => {
			if (w.state === WeaponState.READY && !w.hasFiredThisTurn) result.push(w as WeaponSlot);
		});
		return result;
	}, [ship]);

	const availableTargets = useMemo(() => {
		if (!ship) return [];
		return allShips.filter((t) => t.id !== ship.id && t.faction !== ship.faction);
	}, [ship, allShips]);

	const handleMove = useCallback(() => {
		if (!ship || !canMove) return;
		const radA = (ship.transform.heading * Math.PI) / 180;
		const forwardXA = Math.sin(radA);
		const forwardYA = -Math.cos(radA);
		const rightXA = Math.cos(radA);
		const rightYA = Math.sin(radA);
		let newX = ship.transform.x + forwardXA * movePhaseA + rightXA * movePhaseAStrafe;
		let newY = ship.transform.y + forwardYA * movePhaseA + rightYA * movePhaseAStrafe;
		const newHeading = (((ship.transform.heading + turnAngle) % 360) + 360) % 360;
		const radB = (newHeading * Math.PI) / 180;
		newX += Math.sin(radB) * movePhaseB + Math.cos(radB) * movePhaseBStrafe;
		newY += -Math.cos(radB) * movePhaseB + Math.sin(radB) * movePhaseBStrafe;
		onSendCommand(CC.CMD_MOVE_TOKEN, {
			shipId: ship.id,
			x: newX,
			y: newY,
			heading: newHeading,
			movementPlan: {
				phaseAForward: movePhaseA,
				phaseAStrafe: movePhaseAStrafe,
				turnAngle,
				phaseBForward: movePhaseB,
				phaseBStrafe: movePhaseBStrafe,
			},
		});
		setMovePhaseA(0);
		setMovePhaseAStrafe(0);
		setTurnAngle(0);
		setMovePhaseB(0);
		setMovePhaseBStrafe(0);
	}, [
		ship,
		canMove,
		movePhaseA,
		movePhaseAStrafe,
		turnAngle,
		movePhaseB,
		movePhaseBStrafe,
		onSendCommand,
	]);

	const handleToggleShield = useCallback(() => {
		if (!ship || !canToggleShield) return;
		onSendCommand(CC.CMD_TOGGLE_SHIELD, {
			shipId: ship.id,
			isActive: !ship.isShieldUp,
			orientation: ship.transform.heading,
		});
	}, [ship, canToggleShield, onSendCommand]);

	const handleFire = useCallback(() => {
		if (!ship || !canFire || !selectedWeaponId || !selectedTargetId) return;
		onSendCommand(CC.CMD_FIRE_WEAPON, {
			attackerId: ship.id,
			weaponId: selectedWeaponId,
			targetId: selectedTargetId,
		});
		setSelectedWeaponId(null);
		setSelectedTargetId(null);
	}, [ship, canFire, selectedWeaponId, selectedTargetId, onSendCommand]);

	const handleVent = useCallback(() => {
		if (!ship || !canVent) return;
		onSendCommand(CC.CMD_VENT_FLUX, { shipId: ship.id });
	}, [ship, canVent, onSendCommand]);

	const getStatusMessage = () => {
		if (!ship) return null;
		if (ship.isOverloaded) return { type: "error", text: "舰船过载，无法操作" };
		if (playerRole === PlayerRole.PLAYER && ship.ownerId !== playerSessionId)
			return { type: "warning", text: "这不是你的舰船" };
		if (playerRole === PlayerRole.PLAYER && currentPhase !== "PLAYER_TURN")
			return { type: "warning", text: `当前是${phaseNames[currentPhase] || currentPhase}` };
		if (ship.hasMoved && ship.hasFired) return { type: "success", text: "本回合行动已完成" };
		return null;
	};

	const status = getStatusMessage();

	if (!ship) {
		return (
			<div className="game-panel action-panel">
				<div className="action-header">🎯 操作面板</div>
				<div className="game-empty">选择一艘舰船进行操作</div>
			</div>
		);
	}

	return (
		<div className="game-panel action-panel">
			<div className="action-header">
				🎯 操作面板
				<span className="action-header__id">{ship.id.slice(-6)}</span>
			</div>

			{status && <div className={`action-status action-status--${status.type}`}>{status.text}</div>}

			{/* 移动操作 */}
			<div className="game-section">
				<div className="game-section__title">
					<Rocket className="game-section__icon" />
					移动
				</div>

				<div className="action-slider">
					<div className="action-slider__label">
						<span>阶段A 前进</span>
						<span>
							{movePhaseA} / {ship.maxSpeed * 2}
						</span>
					</div>
					<input
						type="range"
						className="action-slider__input"
						min={-ship.maxSpeed * 2}
						max={ship.maxSpeed * 2}
						value={movePhaseA}
						onChange={(e) => setMovePhaseA(Number(e.target.value))}
						disabled={!canMove}
					/>
				</div>

				<div className="action-slider">
					<div className="action-slider__label">
						<span>阶段A 横移</span>
						<span>
							{movePhaseAStrafe} / {ship.maxSpeed}
						</span>
					</div>
					<input
						type="range"
						className="action-slider__input"
						min={-ship.maxSpeed}
						max={ship.maxSpeed}
						value={movePhaseAStrafe}
						onChange={(e) => setMovePhaseAStrafe(Number(e.target.value))}
						disabled={!canMove}
					/>
				</div>

				<div className="action-slider">
					<div className="action-slider__label">
						<span>转向角度</span>
						<span>
							{turnAngle}° / {ship.maxTurnRate}°
						</span>
					</div>
					<input
						type="range"
						className="action-slider__input"
						min={-ship.maxTurnRate}
						max={ship.maxTurnRate}
						value={turnAngle}
						onChange={(e) => setTurnAngle(Number(e.target.value))}
						disabled={!canMove}
					/>
				</div>

				<div className="action-slider">
					<div className="action-slider__label">
						<span>阶段B 前进</span>
						<span>
							{movePhaseB} / {ship.maxSpeed * 2}
						</span>
					</div>
					<input
						type="range"
						className="action-slider__input"
						min={-ship.maxSpeed * 2}
						max={ship.maxSpeed * 2}
						value={movePhaseB}
						onChange={(e) => setMovePhaseB(Number(e.target.value))}
						disabled={!canMove}
					/>
				</div>

				<div className="action-slider">
					<div className="action-slider__label">
						<span>阶段B 横移</span>
						<span>
							{movePhaseBStrafe} / {ship.maxSpeed}
						</span>
					</div>
					<input
						type="range"
						className="action-slider__input"
						min={-ship.maxSpeed}
						max={ship.maxSpeed}
						value={movePhaseBStrafe}
						onChange={(e) => setMovePhaseBStrafe(Number(e.target.value))}
						disabled={!canMove}
					/>
				</div>

				<button
					data-magnetic
					className={`game-btn game-btn--primary game-btn--full`}
					onClick={handleMove}
					disabled={ship.hasMoved || !canMove}
				>
					{ship.hasMoved ? (
						<>
							<Check className="game-btn__icon" /> 已移动
						</>
					) : (
						<>
							<Rocket className="game-btn__icon" /> 执行移动
						</>
					)}
				</button>
			</div>

			{/* 护盾操作 */}
			<div className="game-section">
				<div className="game-section__title">
					<Sparkles className="game-section__icon" />
					护盾
				</div>
				<button
					data-magnetic
					className={`game-btn game-btn--full ${ship.isShieldUp ? "game-btn--active" : ""}`}
					onClick={handleToggleShield}
					disabled={!canToggleShield}
				>
					<Shield className="game-btn__icon" />
					{ship.isShieldUp ? "关闭护盾" : "开启护盾"}
				</button>
			</div>

			{/* 武器开火 */}
			<div className="game-section">
				<div className="game-section__title">
					<Crosshair className="game-section__icon" />
					开火
				</div>

				<div className="action-weapon-list">
					{availableWeapons.length > 0 ? (
						availableWeapons.map((weapon) => (
							<div
								key={weapon.mountId}
								data-magnetic
								className={`action-weapon-item ${selectedWeaponId === weapon.mountId ? "action-weapon-item--selected" : ""}`}
								onClick={() => setSelectedWeaponId(weapon.mountId)}
							>
								<span className="action-weapon__name">
									{weapon.name || weapon.mountId.slice(-6)}
								</span>
								<span className="action-weapon__stats">
									伤害:{weapon.damage} 射程:{weapon.range}
								</span>
							</div>
						))
					) : (
						<div className="game-empty">
							{ship.weapons.size > 0 ? "武器冷却中..." : "无可用武器"}
						</div>
					)}
				</div>

				{selectedWeaponId && (
					<div className="action-target-select">
						<div className="action-target__label">选择目标:</div>
						{availableTargets.map((target) => (
							<div
								key={target.id}
								data-magnetic
								className={`action-target-item ${selectedTargetId === target.id ? "action-target-item--selected" : ""}`}
								onClick={() => setSelectedTargetId(target.id)}
							>
								<span className="action-target__name">{target.id.slice(-6)}</span>
								<span className="action-target__faction">
									{target.faction === Faction.PLAYER ? "玩家" : "敌方"}
								</span>
							</div>
						))}
					</div>
				)}

				<button
					data-magnetic
					className="game-btn game-btn--danger game-btn--full"
					onClick={handleFire}
					disabled={ship.hasFired || !canFire || !selectedWeaponId || !selectedTargetId}
				>
					{ship.hasFired ? (
						<>
							<Check className="game-btn__icon" /> 已开火
						</>
					) : (
						<>
							<Bomb className="game-btn__icon" /> 开火
						</>
					)}
				</button>
			</div>

			{/* 辐能排散 */}
			<div className="game-section">
				<div className="game-section__title">
					<Zap className="game-section__icon" />
					辐能
				</div>
				<button
					data-magnetic
					className="game-btn game-btn--warning game-btn--full"
					onClick={handleVent}
					disabled={!canVent}
				>
					<Wind className="game-btn__icon" />
					排散辐能
				</button>
				{!canVent && ship && (
					<div className="game-setting__hint game-setting__hint--centered">
						{ship.isShieldUp ? "需要关闭护盾" : "没有辐能可排散"}
					</div>
				)}
			</div>
		</div>
	);
};

export default ShipActionPanel;
