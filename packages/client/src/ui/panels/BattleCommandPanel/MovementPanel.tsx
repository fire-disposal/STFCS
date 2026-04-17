/**
 * 移动控制面板模块
 * 简化版：直接填充Tab内容区，无额外容器/标题
 */

import type { MoveMode, MovementPreviewState } from "@/renderer";
import { type MovementPhaseValue, useGameStore } from "@/state/stores";
import { ClientCommand } from "@/sync/types";
import { notify } from "@/ui/shared/Notification";
import {
	ArrowRight,
	ArrowUp,
	Flag,
	MoveHorizontal,
	MoveVertical,
	RotateCw,
} from "lucide-react";
import React, { useMemo, useCallback, useEffect, useState } from "react";
import type { MovementPanelProps } from "./types";
import "./MovementPanel.css";

// 阶段配置（简化）
const PHASES = ["A", "B", "C"] as const;

export const MovementPanel: React.FC<MovementPanelProps> = ({
	ship,
	disabled,
	networkManager,
	onMovementPreviewChange,
}) => {
	const movementPhase = useGameStore((state) => state.movementPhase);
	const setMovePhaseAction = useGameStore((state) => state.setMovePhase);

	const [moveValue, setMoveValue] = useState(0);
	const [turnInput, setTurnInput] = useState(0);
	const [moveMode, setMoveMode] = useState<MoveMode>("forward");
	const [directionLocked, setDirectionLocked] = useState(false);

	// 同步服务端阶段
	useEffect(() => {
		if (!ship) return;
		const serverPhase = ship.movePhase;
		if (serverPhase && movementPhase !== serverPhase) {
			setMovePhaseAction(serverPhase as MovementPhaseValue);
		}
	}, [ship?.movePhase, movementPhase, setMovePhaseAction]);

	// 计算剩余燃料
	const remainingFuel = useMemo(() => {
		if (!ship) return { forward: 0, strafe: 0, turn: 0 };

		const maxForward = (ship.maxSpeed ?? 0) * 2;
		const maxStrafe = ship.maxSpeed ?? 0;
		const maxTurn = ship.maxTurnRate ?? 0;

		const phaseAForwardUsed = ship.phaseAForwardUsed ?? 0;
		const phaseAStrafeUsed = ship.phaseAStrafeUsed ?? 0;
		const phaseTurnUsed = ship.phaseTurnUsed ?? 0;
		const phaseCForwardUsed = ship.phaseCForwardUsed ?? 0;
		const phaseCStrafeUsed = ship.phaseCStrafeUsed ?? 0;

		switch (movementPhase) {
			case "PHASE_A":
				return {
					forward: Math.max(0, maxForward - phaseAForwardUsed),
					strafe: Math.max(0, maxStrafe - phaseAStrafeUsed),
					turn: 0,
				};
			case "PHASE_B":
				return { forward: 0, strafe: 0, turn: Math.max(0, maxTurn - phaseTurnUsed) };
			case "PHASE_C":
				return {
					forward: Math.max(0, maxForward - phaseCForwardUsed),
					strafe: Math.max(0, maxStrafe - phaseCStrafeUsed),
					turn: 0,
				};
			default:
				return { forward: 0, strafe: 0, turn: 0 };
		}
	}, [ship, movementPhase]);

	const maxMoveValue = useMemo(() => {
		return moveMode === "forward" ? remainingFuel.forward : remainingFuel.strafe;
	}, [moveMode, remainingFuel]);

	// 同步 preview
	useEffect(() => {
		if (onMovementPreviewChange && movementPhase !== "NONE") {
			const preview: MovementPreviewState = {
				phase: movementPhase,
				mode: moveMode,
				value: moveValue,
				turn: turnInput,
				remaining: remainingFuel,
				directionLocked,
			};
			onMovementPreviewChange(preview);
		}
	}, [onMovementPreviewChange, movementPhase, moveMode, moveValue, turnInput, remainingFuel, directionLocked]);

	// 阶段切换重置
	useEffect(() => {
		setMoveValue(0);
		setTurnInput(0);
		setDirectionLocked(false);
		setMoveMode("forward");
	}, [movementPhase]);

	// 执行移动
	const handleExecuteMove = useCallback(async () => {
		if (!ship) return;

		const phase = movementPhase;
		if (phase !== "PHASE_B" && moveValue === 0) {
			notify.warning("请设置移动量");
			return;
		}
		if (phase === "PHASE_B" && turnInput === 0) {
			notify.warning("请设置转向量");
			return;
		}

		const command =
			phase === "PHASE_B"
				? { turn: turnInput }
				: moveMode === "forward"
					? { forward: moveValue }
					: { strafe: moveValue };

		try {
			const room = networkManager.getCurrentRoom();
			if (room) {
				await room.send(ClientCommand.CMD_MOVE_TOKEN, {
					shipId: ship.id,
					x: ship.transform.x,
					y: ship.transform.y,
					heading: ship.transform.heading,
					movementPlan: {
						phaseAForward: phase === "PHASE_A" ? command.forward || 0 : 0,
						phaseAStrafe: phase === "PHASE_A" ? command.strafe || 0 : 0,
						turnAngle: phase === "PHASE_B" ? command.turn || 0 : 0,
						phaseCForward: phase === "PHASE_C" ? command.forward || 0 : 0,
						phaseCStrafe: phase === "PHASE_C" ? command.strafe || 0 : 0,
					},
					phase: phase,
					isIncremental: true,
				});
				notify.success(`移动执行成功`);
				if (phase !== "PHASE_B") setDirectionLocked(true);
				setMoveValue(0);
				setTurnInput(0);
			}
		} catch (error) {
			console.error("[Movement] Execute failed:", error);
			notify.error("移动执行失败");
		}
	}, [ship, movementPhase, moveMode, moveValue, turnInput, networkManager]);

	// 推进阶段
	const handleAdvancePhase = useCallback(() => {
		const room = networkManager.getCurrentRoom();
		if (room && ship) {
			room.send(ClientCommand.CMD_ADVANCE_MOVE_PHASE, { shipId: ship.id });
		}
		setMoveValue(0);
		setTurnInput(0);
		setDirectionLocked(false);
	}, [networkManager, ship]);

	// 切换模式
	const handleModeChange = useCallback(
		(newMode: MoveMode) => {
			if (directionLocked) {
				notify.warning("本阶段已执行移动，方向已锁定");
				return;
			}
			setMoveMode(newMode);
			setMoveValue(0);
		},
		[directionLocked]
	);

	const canMove = !disabled && !ship?.hasMoved && !ship?.isOverloaded;
	const phaseComplete = ship?.hasMoved || movementPhase === "NONE";

	return (
		<div className="movement-content">
			{/* 阶段指示器 */}
			<div className="phase-tabs">
				{PHASES.map((p) => {
					const isActive = movementPhase === `PHASE_${p}`;
					const Icon = p === "B" ? RotateCw : ArrowUp;
					return (
						<div key={p} className={`phase-tab ${isActive ? "phase-tab--active" : ""}`}>
							<Icon className="phase-tab__icon" />
							<span className="phase-tab__label">P{p}</span>
						</div>
					);
				})}
			</div>

			{/* 控制区 */}
			<div className="movement-controls">
				{(movementPhase === "PHASE_A" || movementPhase === "PHASE_C") && (
					<>
						{/* 模式切换 */}
						<div className="mode-switch">
							<button
								className={`mode-btn ${moveMode === "forward" ? "mode-btn--active" : ""}`}
								onClick={() => handleModeChange("forward")}
								disabled={!canMove || (directionLocked && moveMode !== "forward")}
							>
								<MoveVertical className="mode-btn__icon" />
								<span>前向</span>
							</button>
							<button
								className={`mode-btn ${moveMode === "strafe" ? "mode-btn--active" : ""}`}
								onClick={() => handleModeChange("strafe")}
								disabled={!canMove || (directionLocked && moveMode !== "strafe")}
							>
								<MoveHorizontal className="mode-btn__icon" />
								<span>侧向</span>
							</button>
						</div>

						{/* 滑块 */}
						<div className="slider-row">
							<div className="slider-row__header">
								{moveMode === "forward" ? <ArrowUp className="slider-row__icon" /> : <ArrowRight className="slider-row__icon" />}
								<span>{moveMode === "forward" ? "移动" : "侧移"}</span>
								<span className="slider-row__value">{moveValue}/{maxMoveValue}</span>
							</div>
							<div className="slider-row__input-group">
								<input
									type="range"
									className="move-slider"
									min={-maxMoveValue}
									max={maxMoveValue}
									value={moveValue}
									onChange={(e) => setMoveValue(Number(e.target.value))}
									disabled={!canMove}
								/>
								<input
									type="number"
									className="battle-input"
									min={-maxMoveValue}
									max={maxMoveValue}
									value={moveValue}
									onChange={(e) =>
										setMoveValue(
											Math.max(-maxMoveValue, Math.min(maxMoveValue, Number(e.target.value) || 0))
										)
									}
									disabled={!canMove}
								/>
							</div>
						</div>
					</>
				)}

				{movementPhase === "PHASE_B" && (
					<div className="slider-row">
						<div className="slider-row__header">
							<RotateCw className="slider-row__icon" />
							<span>转向</span>
							<span className="slider-row__value">{turnInput}°/{remainingFuel.turn}°</span>
						</div>
						<div className="slider-row__input-group">
							<input
								type="range"
								className="move-slider"
								min={-remainingFuel.turn}
								max={remainingFuel.turn}
								value={turnInput}
								onChange={(e) => setTurnInput(Number(e.target.value))}
								disabled={!canMove}
							/>
							<input
								type="number"
								className="battle-input"
								min={-remainingFuel.turn}
								max={remainingFuel.turn}
								value={turnInput}
								onChange={(e) =>
									setTurnInput(
										Math.max(-remainingFuel.turn, Math.min(remainingFuel.turn, Number(e.target.value) || 0))
									)
								}
								disabled={!canMove}
							/>
						</div>
					</div>
				)}

				{phaseComplete && <div className="movement-complete">已完成</div>}
			</div>

			{/* 操作按钮 */}
			<div className="movement-actions">
				<button
					className="game-btn"
					onClick={handleAdvancePhase}
					disabled={!canMove || movementPhase === "PHASE_C"}
				>
					<Flag className="game-btn__icon" />
					推进
				</button>
				<button
					className="game-btn game-btn--primary"
					onClick={handleExecuteMove}
					disabled={!canMove || phaseComplete}
				>
					执行
				</button>
			</div>
		</div>
	);
};

export default MovementPanel;