/**
 * 燃料池制度移动控制器
 *
 * 支持：
 * - 每个阶段有独立的燃料池
 * - 阶段内任意次数增量移动
 * - 攻击不消耗燃料，可在任何时机进行
 * - 玩家主动切换阶段或燃料耗尽自动结束
 */

import { notify } from "@/components/ui/Notification";
import { useAppDispatch, useAppSelector } from "@/store";
import {
	type MovementCommand,
	MovementPhase,
	clearMovement,
	completeAnimation,
	executeMove,
	getRemainingFuel,
	registerAttack,
	setCurrentPhase,
	startAnimation,
	startMovement,
	validateMove,
} from "@/store/slices/movementSlice";
import type { ShipState } from "@vt/types";
import { ClientCommand } from "@vt/types";
import React, { useCallback, useEffect } from "react";

interface FuelBasedMovementControllerProps {
	ship: ShipState | null;
	networkManager: any;
	onClose: () => void;
	onOpenAttack: () => void;
}

export const FuelBasedMovementController: React.FC<FuelBasedMovementControllerProps> = ({
	ship,
	networkManager,
	onClose,
	onOpenAttack,
}) => {
	const dispatch = useAppDispatch();
	const movementState = useAppSelector((state: any) => state.movement);

	// 本地滑块输入状态
	const [forwardInput, setForwardInput] = React.useState(0);
	const [strafeInput, setStrafeInput] = React.useState(0);
	const [turnInput, setTurnInput] = React.useState(0);

	// 舰船机动参数
	const maxSpeed = ship?.maxSpeed || 100;
	const maxTurnRate = ship?.maxTurnRate || 45;

	// 当前阶段剩余燃料
	const remainingFuel = React.useMemo(() => {
		return getRemainingFuel(movementState, movementState.currentPhase);
	}, [movementState, movementState.currentPhase]);

	// 阶段名称
	const getPhaseName = (phase: MovementPhase): string => {
		switch (phase) {
			case MovementPhase.NONE:
				return "准备";
			case MovementPhase.PHASE_A:
				return "A - 平移";
			case MovementPhase.PHASE_B:
				return "B - 转向";
			case MovementPhase.PHASE_C:
				return "C - 平移";
			case MovementPhase.COMPLETED:
				return "完成";
			default:
				return "未知";
		}
	};

	// 初始化移动流程
	useEffect(() => {
		if (movementState.currentPhase === MovementPhase.NONE && ship) {
			dispatch(
				startMovement({
					maxSpeed: ship.maxSpeed,
					maxTurnRate: ship.maxTurnRate,
				})
			);
		}
	}, [movementState.currentPhase, ship, dispatch]);

	// 与服务端阶段同步
	useEffect(() => {
		if (!ship) return;
		if (movementState.currentPhase === MovementPhase.NONE) return;
		const nextPhase = ship.hasMoved
			? MovementPhase.COMPLETED
			: ship.movePhase === "PHASE_B"
				? MovementPhase.PHASE_B
				: ship.movePhase === "PHASE_C"
					? MovementPhase.PHASE_C
					: MovementPhase.PHASE_A;
		if (movementState.currentPhase !== nextPhase) {
			dispatch(setCurrentPhase(nextPhase));
		}
	}, [ship, ship?.movePhase, ship?.hasMoved, movementState.currentPhase, dispatch]);

	// 输入变化时验证
	useEffect(() => {
		const command: MovementCommand = {};

		switch (movementState.currentPhase) {
			case MovementPhase.PHASE_A:
			case MovementPhase.PHASE_C:
				command.forward = forwardInput;
				command.strafe = strafeInput;
				break;
			case MovementPhase.PHASE_B:
				command.turn = turnInput;
				break;
		}

		dispatch(
			validateMove({
				phase: movementState.currentPhase,
				command,
			})
		);
	}, [forwardInput, strafeInput, turnInput, movementState.currentPhase, dispatch]);

	// 执行增量移动
	const handleExecuteMove = useCallback(async () => {
		if (!ship || !movementState.isValid) return;

		const command: MovementCommand = {};

		switch (movementState.currentPhase) {
			case MovementPhase.PHASE_A:
			case MovementPhase.PHASE_C:
				command.forward = forwardInput;
				command.strafe = strafeInput;
				break;
			case MovementPhase.PHASE_B:
				command.turn = turnInput;
				break;
		}

		try {
			// 开始动画
			dispatch(
				startAnimation({
					phase: movementState.currentPhase,
					command,
				})
			);

			// 发送移动指令到服务器
			const room = networkManager.getCurrentRoom();
			if (room) {
				await room.send(ClientCommand.CMD_MOVE_TOKEN, {
					shipId: ship.id,
					movementPlan: {
						phaseAForward: command.forward || 0,
						phaseAStrafe: command.strafe || 0,
						turnAngle: command.turn || 0,
						phaseCForward: 0,
						phaseCStrafe: 0,
					},
					phase: movementState.currentPhase,
					isIncremental: true, // 标记为增量移动
				});
			}

			// 消耗燃料
			dispatch(
				executeMove({
					phase: movementState.currentPhase,
					command,
				})
			);

			// 模拟动画时间
			setTimeout(() => {
				dispatch(completeAnimation(movementState.currentPhase));
				notify.success(
					`执行移动：前进 ${command.forward || 0}, 侧移 ${command.strafe || 0}, 转向 ${command.turn || 0}°`
				);

				// 重置输入
				setForwardInput(0);
				setStrafeInput(0);
				setTurnInput(0);
			}, 800);

			console.log("[FuelMovement] Incremental move executed:", movementState.currentPhase, command);
		} catch (error) {
			console.error("[FuelMovement] Failed to execute move:", error);
			dispatch(completeAnimation(movementState.currentPhase));
			notify.error("移动执行失败");
		}
	}, [ship, movementState, forwardInput, strafeInput, turnInput, networkManager, dispatch]);

	// 执行攻击
	const handleAttack = useCallback(() => {
		if (onOpenAttack) {
			onOpenAttack();
		}

		dispatch(registerAttack());
		notify.info("武器系统就绪，请选择目标");
	}, [onOpenAttack, dispatch]);

	// 切换阶段
	const handleAdvancePhase = useCallback(() => {
		const room = networkManager.getCurrentRoom();
		if (room && ship) {
			room.send(ClientCommand.CMD_ADVANCE_MOVE_PHASE, { shipId: ship.id });
		}
		setForwardInput(0);
		setStrafeInput(0);
		setTurnInput(0);
	}, [networkManager, ship]);

	// 取消移动
	const handleCancel = useCallback(() => {
		dispatch(clearMovement());
		onClose();
	}, [dispatch, onClose]);

	if (!ship) {
		return <div style={styles.container}>请先选择舰船</div>;
	}

	const currentPhase = movementState.currentPhase;
	const isAnimating = movementState.isAnimating;
	const attackCount = movementState.attacks.attackCount;

	// 渲染燃料条
	const renderFuelBar = (
		label: string,
		icon: string,
		value: number,
		max: number,
		onChange: (value: number) => void,
		disabled: boolean
	) => {
		if (max <= 0) return null;

		const percent = max > 0 ? ((value - -max) / (max * 2)) * 100 : 0;

		return (
			<div style={{ marginBottom: "12px" }}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						marginBottom: "4px",
					}}
				>
					<span style={{ fontSize: "11px", color: "#6b7280" }}>
						{icon} {label}
					</span>
					<span
						style={{
							fontSize: "11px",
							color: value < 0 ? "#ff6f8f" : "#4a9eff",
							fontFamily: "monospace",
						}}
					>
						{value.toFixed(0)} / {max.toFixed(0)}
					</span>
				</div>

				{/* 滑块轨道 */}
				<div
					style={{
						position: "relative" as const,
						height: "8px",
						backgroundColor: "rgba(0, 0, 0, 0.5)",
						borderRadius: "4px",
					}}
				>
					{/* 零点标记 */}
					<div
						style={{
							position: "absolute",
							left: "50%",
							top: "0",
							bottom: "0",
							width: "2px",
							backgroundColor: "#6b7280",
						}}
					/>

					{/* 填充条 */}
					<div
						style={{
							position: "absolute",
							left: "50%",
							top: "0",
							bottom: "0",
							width: `${(Math.abs(value) / max) * 50}%`,
							backgroundColor: value < 0 ? "#ff6f8f" : "#4a9eff",
							borderRadius: "4px",
							transition: "width 0.2s",
						}}
					/>

					{/* 滑块手柄 */}
					<input
						type="range"
						min={-max}
						max={max}
						step={1}
						value={value}
						onChange={(e) => onChange(parseFloat(e.target.value))}
						disabled={disabled || isAnimating}
						style={{
							position: "absolute",
							left: "0",
							right: "0",
							width: "100%",
							height: "100%",
							opacity: 0,
							cursor: "pointer",
						}}
					/>
					<div
						style={{
							position: "absolute",
							left: `calc(50% + ${percent - 50}%)`,
							top: "50%",
							transform: "translate(-50%, -50%)",
							width: "16px",
							height: "16px",
							backgroundColor: value < 0 ? "#ff6f8f" : "#4a9eff",
							borderRadius: "50%",
							border: "2px solid #fff",
							boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
							pointerEvents: "none" as const,
							transition: "left 0.2s",
						}}
					/>
				</div>

				{/* 刻度标记 */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						marginTop: "4px",
					}}
				>
					<span style={{ fontSize: "9px", color: "#6b7280" }}>-{max}</span>
					<span style={{ fontSize: "9px", color: "#6b7280" }}>0</span>
					<span style={{ fontSize: "9px", color: "#6b7280" }}>{max}</span>
				</div>
			</div>
		);
	};

	// 渲染阶段输入
	const renderPhaseInputs = () => {
		switch (currentPhase) {
			case MovementPhase.PHASE_A:
			case MovementPhase.PHASE_C:
				return (
					<>
						<div style={styles.phaseGroup}>
							<div style={styles.phaseTitle}>
								{isAnimating ? "⏳" : "📍"} {getPhaseName(currentPhase)}
								{isAnimating && (
									<span style={{ color: "#f1c40f", fontSize: "10px" }}>执行中...</span>
								)}
							</div>

							{renderFuelBar(
								"前进/后退",
								"⬆️",
								forwardInput,
								remainingFuel.forward,
								setForwardInput,
								isAnimating
							)}

							{renderFuelBar(
								"侧移",
								"➡️",
								strafeInput,
								remainingFuel.strafe,
								setStrafeInput,
								isAnimating
							)}

							{/* 剩余燃料显示 */}
							<div style={{ fontSize: "10px", color: "#6b7280", marginTop: "8px" }}>
								剩余：前进 {remainingFuel.forward.toFixed(0)} | 侧移{" "}
								{remainingFuel.strafe.toFixed(0)}
							</div>
						</div>
					</>
				);

			case MovementPhase.PHASE_B:
				return (
					<>
						<div style={styles.phaseGroup}>
							<div style={styles.phaseTitle}>
								{isAnimating ? "⏳" : "🔄"} {getPhaseName(currentPhase)}
								{isAnimating && (
									<span style={{ color: "#f1c40f", fontSize: "10px" }}>执行中...</span>
								)}
							</div>

							{renderFuelBar(
								"转向",
								"🔄",
								turnInput,
								remainingFuel.turn,
								setTurnInput,
								isAnimating
							)}

							{/* 剩余燃料显示 */}
							<div style={{ fontSize: "10px", color: "#6b7280", marginTop: "8px" }}>
								剩余：转向 {remainingFuel.turn.toFixed(0)}°
							</div>
						</div>
					</>
				);

			case MovementPhase.COMPLETED:
				return (
					<div style={styles.phaseGroup}>
						<div style={{ padding: "16px", textAlign: "center" as const, color: "#2ecc71" }}>
							✅ 本回合移动已完成
						</div>
					</div>
				);

			default:
				return (
					<div style={styles.phaseGroup}>
						<div style={{ padding: "16px", textAlign: "center" as const, color: "#6b7280" }}>
							准备开始移动...
						</div>
					</div>
				);
		}
	};

	// 攻击状态显示
	const renderAttackStatus = () => {
		if (attackCount === 0) {
			return (
				<div style={styles.attackStatus}>
					<div style={styles.attackStatusText}>⚔️ 可以在任何阶段进行攻击</div>
				</div>
			);
		}

		return (
			<div style={styles.attackStatus}>
				<div style={styles.attackStatusText}>✅ 本回合已攻击 {attackCount} 次</div>
			</div>
		);
	};

	// 检查是否可以进入下一阶段
	const canAdvancePhase = () => {
		if (currentPhase === MovementPhase.COMPLETED) return false;
		return !isAnimating;
	};

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<span>🚀 燃料池移动控制</span>
				<span style={{ fontSize: "11px", color: "#6b7280" }}>
					速度：{maxSpeed} | 转向：{maxTurnRate}°
				</span>
			</div>

			{/* 阶段指示器 */}
			<div style={styles.phaseIndicator}>
				{(
					[MovementPhase.PHASE_A, MovementPhase.PHASE_B, MovementPhase.PHASE_C] as MovementPhase[]
				).map((p) => {
					const isActive = p === currentPhase;
					const isCompleted =
						(currentPhase === MovementPhase.PHASE_B && p === MovementPhase.PHASE_A) ||
						(currentPhase === MovementPhase.PHASE_C && p !== MovementPhase.PHASE_C) ||
						currentPhase === MovementPhase.COMPLETED;

					return (
						<div
							key={p}
							style={{
								...styles.phaseStep,
								...(isActive ? styles.phaseStepActive : {}),
								...(isCompleted ? styles.phaseStepCompleted : {}),
							}}
						>
							{getPhaseName(p)}
						</div>
					);
				})}
			</div>

			{/* 阶段输入 */}
			{renderPhaseInputs()}

			{/* 验证错误 */}
			{!movementState.isValid && movementState.validationError && (
				<div style={styles.validationError}>⚠️ {movementState.validationError}</div>
			)}

			{/* 攻击状态 */}
			{currentPhase !== MovementPhase.COMPLETED &&
				currentPhase !== MovementPhase.NONE &&
				renderAttackStatus()}

			{/* 操作按钮 */}
			<div style={styles.buttonGroup}>
				{currentPhase !== MovementPhase.COMPLETED &&
					currentPhase !== MovementPhase.NONE &&
					!isAnimating && (
						<>
							<button
								style={{
									...styles.button,
									...styles.buttonPrimary,
									...(!movementState.isValid ? styles.buttonDisabled : {}),
								}}
								onClick={handleExecuteMove}
								disabled={!movementState.isValid}
							>
								▶️ 执行移动
							</button>

							<button
								style={{
									...styles.button,
									...styles.buttonAttack,
								}}
								onClick={handleAttack}
							>
								⚔️ 攻击
							</button>
						</>
					)}

				{currentPhase !== MovementPhase.COMPLETED && currentPhase !== MovementPhase.NONE && (
					<button
						style={{
							...styles.button,
							...styles.buttonNext,
						}}
						onClick={handleAdvancePhase}
						disabled={!canAdvancePhase()}
					>
						⏭️ 下一阶段
					</button>
				)}

				{currentPhase === MovementPhase.COMPLETED && (
					<button
						style={{
							...styles.button,
							...styles.buttonNext,
						}}
						onClick={onClose}
					>
						✅ 完成移动
					</button>
				)}

				<button
					style={{
						...styles.button,
						...styles.buttonDanger,
					}}
					onClick={handleCancel}
				>
					取消
				</button>
			</div>
		</div>
	);
};

const styles = {
	container: {
		backgroundColor: "rgba(6, 16, 26, 0.95)",
		borderRadius: "8px",
		padding: "16px",
		boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
		border: "1px solid #2b4261",
		marginBottom: "12px",
	},
	header: {
		fontSize: "14px",
		fontWeight: "bold" as const,
		color: "#cfe8ff",
		marginBottom: "12px",
		borderBottom: "1px solid #2b4261",
		paddingBottom: "8px",
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
	},
	phaseIndicator: {
		display: "flex",
		gap: "4px",
		marginBottom: "16px",
	},
	phaseStep: {
		flex: 1,
		padding: "8px 4px",
		backgroundColor: "rgba(20, 30, 40, 0.6)",
		border: "1px solid #2b4261",
		borderRadius: "4px",
		textAlign: "center" as const,
		fontSize: "10px",
		color: "#6b7280",
		transition: "all 0.3s",
	},
	phaseStepActive: {
		backgroundColor: "rgba(74, 158, 255, 0.2)",
		borderColor: "#4a9eff",
		color: "#4a9eff",
	},
	phaseStepCompleted: {
		backgroundColor: "rgba(46, 204, 113, 0.2)",
		borderColor: "#2ecc71",
		color: "#2ecc71",
	},
	phaseGroup: {
		marginBottom: "16px",
	},
	phaseTitle: {
		fontSize: "12px",
		fontWeight: "bold" as const,
		color: "#7aa2d4",
		marginBottom: "8px",
		display: "flex",
		alignItems: "center",
		gap: "6px",
	},
	buttonGroup: {
		display: "flex",
		gap: "8px",
		marginTop: "12px",
	},
	button: {
		flex: 1,
		padding: "10px 12px",
		borderRadius: "0",
		border: "none",
		fontSize: "12px",
		fontWeight: "bold" as const,
		cursor: "pointer",
		transition: "all 0.2s",
	},
	buttonPrimary: {
		backgroundColor: "#1a4a7a",
		color: "#4a9eff",
	},
	buttonAttack: {
		backgroundColor: "#5a2a3a",
		color: "#ff6f8f",
	},
	buttonNext: {
		backgroundColor: "#1a5a3a",
		color: "#2ecc71",
	},
	buttonDanger: {
		backgroundColor: "#5a2a3a",
		color: "#ff6f8f",
	},
	buttonDisabled: {
		opacity: 0.5,
		cursor: "not-allowed",
	},
	validationError: {
		padding: "8px",
		background: "rgba(255, 74, 74, 0.15)",
		border: "1px solid #ff4a4a",
		color: "#ff6f8f",
		fontSize: "11px",
		marginTop: "8px",
	},
	attackStatus: {
		padding: "12px",
		backgroundColor: "rgba(255, 100, 100, 0.1)",
		border: "1px solid rgba(255, 100, 100, 0.3)",
		borderRadius: "4px",
		marginTop: "12px",
	},
	attackStatusText: {
		fontSize: "11px",
		color: "#ff6f8f",
		textAlign: "center" as const,
	},
};

export default FuelBasedMovementController;
