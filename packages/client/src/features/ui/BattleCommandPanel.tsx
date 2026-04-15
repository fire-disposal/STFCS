/**
 * 战斗命令面板 - 全新设计的底部面板
 *
 * 5列紧凑布局：
 * - 列1：舰船头像 + 基本信息
 * - 列2：船体/辐能/护甲状态条
 * - 列3：移动控制（三阶段燃料池）
 * - 列4：武器 + 技能按钮
 * - 列5：回合状态 + 结束按钮
 */

import { useAppDispatch, useAppSelector } from "@/store";
import {
	MovementPhase,
	clearMovement,
	executeMove,
	getRemainingFuel,
	startMovement,
	validateMove,
	setCurrentPhase,
} from "@/store/slices/movementSlice";
import { notify } from "@/components/ui/Notification";
import type { ShipState, WeaponSlot } from "@vt/types";
import { Faction, ClientCommand } from "@vt/types";
import {
	Bomb,
	Crosshair,
	Flag,
	Heart,
	Rocket,
	Shield,
	Target,
	Wind,
	Zap,
	Navigation2,
	RotateCw,
	ArrowUp,
	ArrowLeft,
	ArrowRight,
} from "lucide-react";
import React, { useMemo, useCallback, useEffect, useState } from "react";
import "./battle-panel.css";

interface BattleCommandPanelProps {
	selectedShip?: ShipState | null;
	networkManager: any;
	onToggleShield?: () => void;
	onFire?: (weaponId?: string) => void;
	onVent?: () => void;
	onToggleReady?: () => void;
	isReady?: boolean;
	readyLocked?: boolean;
	disabled?: boolean;
}

// 阶段配置
const PHASE_CONFIG = {
	A: { label: "Phase A", sub: "平移", icon: ArrowUp },
	B: { label: "Phase B", sub: "转向", icon: RotateCw },
	C: { label: "Phase C", sub: "平移", icon: ArrowUp },
};

export const BattleCommandPanel: React.FC<BattleCommandPanelProps> = ({
	selectedShip,
	networkManager,
	onToggleShield,
	onFire,
	onVent,
	onToggleReady,
	isReady = false,
	readyLocked = false,
	disabled = false,
}) => {
	const dispatch = useAppDispatch();
	const movementState = useAppSelector((state) => state.movement);

	// 本地滑块输入值
	const [forwardInput, setForwardInput] = useState(0);
	const [strafeInput, setStrafeInput] = useState(0);
	const [turnInput, setTurnInput] = useState(0);

	// 初始化移动状态
	useEffect(() => {
		if (selectedShip && movementState.currentPhase === MovementPhase.NONE) {
			dispatch(
				startMovement({
					maxSpeed: selectedShip.maxSpeed,
					maxTurnRate: selectedShip.maxTurnRate,
				})
			);
		}
	}, [selectedShip, movementState.currentPhase, dispatch]);

	// 同步服务端阶段状态
	useEffect(() => {
		if (!selectedShip) return;
		const serverPhase = selectedShip.movePhase;
		if (serverPhase && movementState.currentPhase !== MovementPhase.NONE) {
			const mappedPhase = serverPhase === "PHASE_B" ? MovementPhase.PHASE_B :
				serverPhase === "PHASE_C" ? MovementPhase.PHASE_C :
				MovementPhase.PHASE_A;
			if (movementState.currentPhase !== mappedPhase) {
				dispatch(setCurrentPhase(mappedPhase));
			}
		}
	}, [selectedShip?.movePhase, movementState.currentPhase, dispatch]);

	// 当前阶段剩余燃料
	const remainingFuel = useMemo(() => {
		return getRemainingFuel(movementState, movementState.currentPhase);
	}, [movementState]);

	// 验证输入
	useEffect(() => {
		const phase = movementState.currentPhase;
		if (phase === MovementPhase.NONE || phase === MovementPhase.COMPLETED) return;

		const command = phase === MovementPhase.PHASE_B
			? { turn: turnInput }
			: { forward: forwardInput, strafe: strafeInput };

		dispatch(validateMove({ phase, command }));
	}, [forwardInput, strafeInput, turnInput, movementState.currentPhase, dispatch]);

	// 执行移动
	const handleExecuteMove = useCallback(async () => {
		if (!selectedShip || !movementState.isValid) return;

		const phase = movementState.currentPhase;
		const command = phase === MovementPhase.PHASE_B
			? { turn: turnInput }
			: { forward: forwardInput, strafe: strafeInput };

		try {
			const room = networkManager.getCurrentRoom();
			if (room) {
				await room.send(ClientCommand.CMD_MOVE_TOKEN, {
					shipId: selectedShip.id,
					x: selectedShip.transform.x, // 增量移动虽然不强制，但带上当前状态作为冗余确保安全
					y: selectedShip.transform.y,
					heading: selectedShip.transform.heading,
					movementPlan: {
						phaseAForward: command.forward || 0,
						phaseAStrafe: command.strafe || 0,
						turnAngle: command.turn || 0,
						phaseCForward: 0,
						phaseCStrafe: 0,
					},
					phase: phase,
					isIncremental: true,
				});
			}

			dispatch(executeMove({ phase, command }));

			const phaseName = phase === MovementPhase.PHASE_A ? "A" :
				phase === MovementPhase.PHASE_B ? "B" : "C";
			notify.success(`移动执行成功 [Phase ${phaseName}]`);

			// 重置输入
			setForwardInput(0);
			setStrafeInput(0);
			setTurnInput(0);
		} catch (error) {
			console.error("[Movement] Execute failed:", error);
			notify.error("移动执行失败");
		}
	}, [selectedShip, movementState, forwardInput, strafeInput, turnInput, networkManager, dispatch]);

	// 推进到下一阶段
	const handleAdvancePhase = useCallback(() => {
		const room = networkManager.getCurrentRoom();
		if (room && selectedShip) {
			room.send(ClientCommand.CMD_ADVANCE_MOVE_PHASE, { shipId: selectedShip.id });
		}
		setForwardInput(0);
		setStrafeInput(0);
		setTurnInput(0);
	}, [networkManager, selectedShip]);

	// 计算状态
	const hullPercent = useMemo(() => {
		if (!selectedShip || selectedShip.hull.max <= 0) return 0;
		return Math.round(selectedShip.hull.percent);
	}, [selectedShip]);

	const fluxPercent = useMemo(() => {
		if (!selectedShip || selectedShip.flux.max <= 0) return 0;
		return Math.round(selectedShip.flux.percent);
	}, [selectedShip]);

	const armorAverage = useMemo(() => {
		if (!selectedShip) return 0;
		let total = 0;
		for (let i = 0; i < selectedShip.armor.quadrants.length; i++) {
			total += selectedShip.armor.quadrants[i] || 0;
		}
		return Math.round(total / 6);
	}, [selectedShip]);

	const weapons = useMemo(() => {
		if (!selectedShip) return [];
		const result: WeaponSlot[] = [];
		selectedShip.weapons.forEach((weapon) => {
			result.push(weapon);
		});
		return result;
	}, [selectedShip]);

	// 颜色计算
	const getHullColor = (pct: number) =>
		pct > 50 ? "#2ecc71" : pct > 25 ? "#f39c12" : "#e74c3c";

	const getArmorColor = (pct: number) =>
		pct > 75 ? "#2ecc71" : pct > 50 ? "#f1c40f" : pct > 25 ? "#e67e22" : "#e74c3c";

	const isPlayer = selectedShip?.faction === Faction.PLAYER;
	const canMove = !disabled && !selectedShip?.hasMoved && !selectedShip?.isOverloaded;
	const phaseComplete = selectedShip?.hasMoved || movementState.currentPhase === MovementPhase.COMPLETED;

	// 无选中舰船
	if (!selectedShip) {
		return (
			<div className="battle-panel">
				<div className="battle-panel__empty">
					<Rocket className="battle-panel__empty-icon" />
					<span>选择舰船以查看详情</span>
				</div>
			</div>
		);
	}

	return (
		<div className="battle-panel">
			{/* 列1：舰船头像 */}
			<div className="battle-panel__column battle-panel__column--portrait">
				<div className="ship-portrait">
					<div className="ship-portrait__frame">
						<Rocket className="ship-portrait__icon" />
					</div>
					<div className="ship-portrait__info">
						<div className="ship-portrait__name">{selectedShip.name || selectedShip.hullType}</div>
						<div className={`ship-portrait__faction ${isPlayer ? "ship-portrait__faction--player" : "ship-portrait__faction--enemy"}`}>
							{isPlayer ? "友军" : "敌方"}
						</div>
						<div className="ship-portrait__id">{selectedShip.id.slice(-8)}</div>
					</div>
				</div>
			</div>

			{/* 列2：状态条 */}
			<div className="battle-panel__column battle-panel__column--stats">
				<div className="stat-block">
					<div className="stat-block__header">
						<Heart className="stat-block__icon" style={{ color: "#e74c3c" }} />
						<span className="stat-block__label">船体</span>
						<span className="stat-block__value">{hullPercent}%</span>
					</div>
					<div className="stat-bar">
						<div
							className="stat-bar__fill"
							style={{ width: `${hullPercent}%`, backgroundColor: getHullColor(hullPercent) }}
						/>
					</div>
				</div>

				<div className="stat-block">
					<div className="stat-block__header">
						<Zap className="stat-block__icon" style={{ color: "#f1c40f" }} />
						<span className="stat-block__label">辐能</span>
						<span className="stat-block__value">
							{Math.round(selectedShip.flux.soft)}/{selectedShip.flux.max}
						</span>
					</div>
					<div className="stat-bar stat-bar--flux">
						<div
							className="stat-bar__fill stat-bar__fill--soft"
							style={{ width: `${(selectedShip.flux.soft / selectedShip.flux.max) * 100}%` }}
						/>
						<div
							className="stat-bar__fill stat-bar__fill--hard"
							style={{ width: `${(selectedShip.flux.hard / selectedShip.flux.max) * 100}%` }}
						/>
					</div>
					{selectedShip.isOverloaded && (
						<div className="stat-block__warning">
							<Zap className="stat-block__warning-icon" />
							过载 {Math.round(selectedShip.overloadTime)}s
						</div>
					)}
				</div>

				<div className="stat-block">
					<div className="stat-block__header">
						<Shield className="stat-block__icon" style={{ color: "#f39c12" }} />
						<span className="stat-block__label">护甲</span>
						<span className="stat-block__value">{armorAverage}</span>
					</div>
					<div className="armor-grid">
						{Array.from({ length: selectedShip.armor.quadrants.length }, (_, idx) => {
							const val = selectedShip.armor.quadrants[idx];
							const pct = selectedShip.armor.maxPerQuadrant > 0
								? (val / selectedShip.armor.maxPerQuadrant) * 100 : 0;
							return (
								<div
									key={idx}
									className="armor-cell"
									style={{ backgroundColor: getArmorColor(pct) }}
								>
									{val}
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* 列3：移动控制 */}
			<div className="battle-panel__column battle-panel__column--movement">
				<div className="movement-panel">
					<div className="movement-panel__header">
						<Navigation2 className="movement-panel__header-icon" />
						<span>移动</span>
					</div>

					{/* 主体：左右3:1分栏 */}
					<div className="movement-panel__body">
						{/* 左侧：阶段指示器 + 滑块 */}
						<div className="movement-panel__left">
							{/* 阶段指示器 */}
							<div className="phase-tabs">
								{(["A", "B", "C"] as const).map((p) => {
									const isActive = movementState.currentPhase ===
										(p === "A" ? MovementPhase.PHASE_A : p === "B" ? MovementPhase.PHASE_B : MovementPhase.PHASE_C);
									const Icon = PHASE_CONFIG[p].icon;
									return (
										<div key={p} className={`phase-tab ${isActive ? "phase-tab--active" : ""}`}>
											<Icon className="phase-tab__icon" />
											<span className="phase-tab__label">{PHASE_CONFIG[p].label}</span>
											<span className="phase-tab__sub">{PHASE_CONFIG[p].sub}</span>
										</div>
									);
								})}
							</div>

							{/* 滑块区域 */}
							<div className="movement-sliders">
								{(movementState.currentPhase === MovementPhase.PHASE_A ||
									movementState.currentPhase === MovementPhase.PHASE_C) && (
									<>
										<div className="slider-row">
											<div className="slider-row__header">
												<ArrowUp className="slider-row__icon" />
												<span>前进</span>
												<span className="slider-row__value">
													{forwardInput}/{remainingFuel.forward}
												</span>
											</div>
											<input
												type="range"
												className="battle-slider"
												min={-remainingFuel.forward}
												max={remainingFuel.forward}
												value={forwardInput}
												onChange={(e) => setForwardInput(Number(e.target.value))}
												disabled={!canMove}
											/>
										</div>
										<div className="slider-row">
											<div className="slider-row__header">
												<ArrowRight className="slider-row__icon" />
												<span>侧移</span>
												<span className="slider-row__value">
													{strafeInput}/{remainingFuel.strafe}
												</span>
											</div>
											<input
												type="range"
												className="battle-slider"
												min={-remainingFuel.strafe}
												max={remainingFuel.strafe}
												value={strafeInput}
												onChange={(e) => setStrafeInput(Number(e.target.value))}
												disabled={!canMove}
											/>
										</div>
									</>
								)}

								{movementState.currentPhase === MovementPhase.PHASE_B && (
									<div className="slider-row">
										<div className="slider-row__header">
											<RotateCw className="slider-row__icon" />
											<span>转向</span>
											<span className="slider-row__value">
												{turnInput}°/{remainingFuel.turn}°
											</span>
										</div>
										<input
											type="range"
											className="battle-slider"
											min={-remainingFuel.turn}
											max={remainingFuel.turn}
											value={turnInput}
											onChange={(e) => setTurnInput(Number(e.target.value))}
											disabled={!canMove}
										/>
									</div>
								)}
							</div>

							{/* 验证错误 */}
							{!movementState.isValid && movementState.validationError && (
								<div className="movement-error">{movementState.validationError}</div>
							)}

							{phaseComplete && (
								<div className="movement-complete">已完成</div>
							)}
						</div>

						{/* 右侧：按钮（上推进，下执行） */}
						<div className="movement-panel__right">
							<button
								className="battle-btn battle-btn--secondary"
								onClick={handleAdvancePhase}
								disabled={!canMove || movementState.currentPhase === MovementPhase.PHASE_C}
							>
								<Flag className="battle-btn__icon" />
								<span>推进</span>
							</button>
							<button
								className="battle-btn battle-btn--primary"
								onClick={handleExecuteMove}
								disabled={!canMove || !movementState.isValid || phaseComplete}
							>
								<Navigation2 className="battle-btn__icon" />
								<span>执行</span>
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* 列4：武器 + 技能 */}
			<div className="battle-panel__column battle-panel__column--combat">
				<div className="combat-panel">
					<div className="combat-panel__header">
						<Crosshair className="combat-panel__header-icon" />
						<span>武器</span>
					</div>
					<div className="weapon-list">
						{weapons.map((weapon, idx) => {
							const isReady = weapon.state === "ready";
							const isCooldown = weapon.state === "cooldown";
							const isEmpty = weapon.state === "out_of_ammo";
							return (
								<button
									key={weapon.mountId}
									className={`weapon-item ${isReady ? "weapon-item--ready" : ""} ${isCooldown ? "weapon-item--cooldown" : ""} ${isEmpty ? "weapon-item--empty" : ""}`}
									onClick={() => onFire?.(weapon.mountId)}
									disabled={disabled || !isReady || selectedShip.isOverloaded}
								>
									<Target className="weapon-item__icon" />
									<span className="weapon-item__name">{weapon.name || `W${idx + 1}`}</span>
									<span className={`weapon-status ${isReady ? "weapon-status--ready" : isCooldown ? "weapon-status--cooldown" : "weapon-status--empty"}`}>
										{isReady ? "OK" : isCooldown ? "CD" : "空"}
									</span>
								</button>
							);
						})}
					</div>
					<button
						className="battle-btn battle-btn--danger battle-btn--block"
						onClick={() => onFire?.()}
						disabled={disabled || selectedShip.hasFired || selectedShip.isOverloaded || weapons.length === 0}
					>
						<Bomb className="battle-btn__icon" />
						{selectedShip.hasFired ? "已开火" : "开火"}
					</button>
				</div>

				<div className="skills-panel">
					<div className="skills-panel__header">
						<span>技能</span>
					</div>
					<div className="skills-panel__buttons">
						<button
							className={`battle-btn battle-btn--shield ${selectedShip.shield.active ? "battle-btn--active" : ""}`}
							onClick={onToggleShield}
							disabled={disabled || (selectedShip.isOverloaded && !selectedShip.shield.active)}
						>
							<Shield className="battle-btn__icon" />
							{selectedShip.shield.active ? "护盾" : "开盾"}
						</button>
						<button
							className="battle-btn battle-btn--vent"
							onClick={onVent}
							disabled={disabled || selectedShip.shield.active || selectedShip.flux.soft + selectedShip.flux.hard <= 0}
						>
							<Wind className="battle-btn__icon" />
							排散
						</button>
					</div>
				</div>
			</div>

			{/* 列5：回合控制 */}
			<div className="battle-panel__column battle-panel__column--turn">
				<div className="turn-panel">
					<div className="turn-panel__status">
						{selectedShip.hasMoved && <span className="status-badge status-badge--moved">已移动</span>}
						{selectedShip.hasFired && <span className="status-badge status-badge--fired">已开火</span>}
						{selectedShip.shield.active && <span className="status-badge status-badge--shield">护盾</span>}
						{selectedShip.isOverloaded && <span className="status-badge status-badge--overload">过载</span>}
					</div>
					<button
						className={`battle-btn battle-btn--turn ${isReady ? "battle-btn--active" : ""}`}
						onClick={onToggleReady}
						disabled={disabled || readyLocked || !onToggleReady}
					>
						<Flag className="battle-btn__icon" />
						{isReady ? "取消" : "结束回合"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default BattleCommandPanel;