/**
 * 移动面板 - D-pad 方向选择 + 滑动条预览 + 执行
 *
 * Phase A/C：D-pad 选择方向，调整距离，确认执行
 * Phase B：旋转滑动条 + 执行
 */

import React, { useState, useCallback, useEffect } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCw, Check, ChevronRight, Navigation } from "lucide-react";
import type { CombatToken } from "@vt/data";
import { Button, Flex, Box, Text, TextField, Badge } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useUIStore } from "@/state/stores/uiStore";
import "./battle-panel.css";

type Direction = "forward" | "backward" | "left" | "right" | null;

export interface MovementPanelProps {
	ship: CombatToken | null;
	canControl: boolean;
}

export const MovementPanel: React.FC<MovementPanelProps> = ({ ship, canControl }) => {
	const { isAvailable, sendMove, sendRotate, sendAdvancePhase } = useGameAction();
	const { setMovementPreview } = useUIStore();

	const hasShip = ship && ship.runtime;
	const movement = hasShip ? ship.runtime.movement : null;
	const phase = movement?.currentPhase ?? "DONE";

	const phaseAUsed = movement?.phaseAUsed ?? 0;
	const phaseCUsed = movement?.phaseCUsed ?? 0;
	const turnUsed = movement?.turnAngleUsed ?? 0;

	const maxSpeed = hasShip ? (ship.spec.maxSpeed ?? 100) : 100;
	const maxTurnRate = hasShip ? (ship.spec.maxTurnRate ?? 60) : 60;

	const phaseARemaining = maxSpeed - phaseAUsed;
	const phaseCRemaining = maxSpeed - phaseCUsed;
	const turnRemaining = maxTurnRate - turnUsed;

	const modeLocked = Boolean(movement?.phaseALock || movement?.phaseCLock);
	const phaseALocked = movement?.phaseALock;
	const phaseCLocked = movement?.phaseCLock;

	const isAvailableShip = canControl && hasShip && isAvailable && phase !== "DONE";

	const [selectedDirection, setSelectedDirection] = useState<Direction>(null);
	const [translateValue, setTranslateValue] = useState(0);
	const [rotateValue, setRotateValue] = useState(0);

	useEffect(() => {
		setSelectedDirection(null);
		setTranslateValue(0);
		setRotateValue(0);
	}, [phase, ship?.$id]);

	useEffect(() => {
		return () => setMovementPreview(null);
	}, [setMovementPreview]);

	const clearPreview = useCallback(() => {
		setMovementPreview(null);
	}, [setMovementPreview]);

	const updatePreview = useCallback((direction: Direction, value: number) => {
		if (!hasShip) {
			clearPreview();
			return;
		}

		let mode: "forward" | "strafe" = "forward";
		let actualValue = value;

		if (direction === "forward") {
			mode = "forward";
			actualValue = Math.abs(value);
		} else if (direction === "backward") {
			mode = "forward";
			actualValue = -Math.abs(value);
		} else if (direction === "right") {
			mode = "strafe";
			actualValue = Math.abs(value);
		} else if (direction === "left") {
			mode = "strafe";
			actualValue = -Math.abs(value);
		}

		setMovementPreview({
			shipId: ship.$id,
			phase,
			mode,
			value: actualValue,
			turn: 0,
			remaining: {
				forward: phaseARemaining,
				strafe: phaseCRemaining,
				turn: turnRemaining,
			},
			directionLocked: Boolean(modeLocked || phaseALocked || phaseCLocked),
		});
	}, [hasShip, ship, phase, phaseARemaining, phaseCRemaining, turnRemaining, modeLocked, phaseALocked, phaseCLocked, setMovementPreview, clearPreview]);

	const handleDirectionSelect = (direction: Direction) => {
		if (phase === "A" && phaseALocked) {
			const lockedDir = phaseALocked === "FORWARD_BACKWARD" ?
				(direction === "forward" || direction === "backward" ? direction : null) :
				(direction === "left" || direction === "right" ? direction : null);
			if (!lockedDir) return;
			setSelectedDirection(lockedDir);
		} else if (phase === "C" && phaseCLocked) {
			const lockedDir = phaseCLocked === "FORWARD_BACKWARD" ?
				(direction === "forward" || direction === "backward" ? direction : null) :
				(direction === "left" || direction === "right" ? direction : null);
			if (!lockedDir) return;
			setSelectedDirection(lockedDir);
		} else {
			setSelectedDirection(direction);
		}
		setTranslateValue(0);
		updatePreview(direction, 0);
	};

	const handleTranslateChange = (value: number) => {
		const maxRemaining = phase === "A" ? phaseARemaining : phaseCRemaining;
		const clamped = Math.max(0, Math.min(maxRemaining, value));
		setTranslateValue(clamped);
		updatePreview(selectedDirection, clamped);
	};

	const handleRotateChange = (value: number) => {
		const clamped = Math.max(-turnRemaining, Math.min(turnRemaining, value));
		setRotateValue(clamped);
		if (!hasShip) return;
		setMovementPreview({
			shipId: ship.$id,
			phase: "B",
			mode: "forward",
			value: 0,
			turn: clamped,
			remaining: {
				forward: phaseARemaining,
				strafe: phaseCRemaining,
				turn: turnRemaining,
			},
			directionLocked: false,
		});
	};

	const handleExecute = async () => {
		if (!isAvailableShip) return;
		clearPreview();

		if (phase === "A" || phase === "C") {
			if (!selectedDirection || translateValue === 0) return;

			let forward = 0;
			let strafe = 0;

			if (selectedDirection === "forward") {
				forward = translateValue;
			} else if (selectedDirection === "backward") {
				forward = -translateValue;
			} else if (selectedDirection === "right") {
				strafe = translateValue;
			} else if (selectedDirection === "left") {
				strafe = -translateValue;
			}

			await sendMove(ship.$id, forward, strafe);
			setSelectedDirection(null);
			setTranslateValue(0);
		} else if (phase === "B") {
			if (rotateValue === 0) return;
			await sendRotate(ship.$id, rotateValue);
			setRotateValue(0);
		}
	};

	const handleAdvancePhase = async () => {
		if (!isAvailableShip) return;
		clearPreview();
		setSelectedDirection(null);
		setTranslateValue(0);
		setRotateValue(0);
		await sendAdvancePhase(ship.$id);
	};

	const canSelectForwardBackward = phase === "A" && (!modeLocked || phaseALocked === "FORWARD_BACKWARD");
	const canSelectLeftRight = phase === "C" && (!modeLocked || phaseCLocked === "LEFT_RIGHT") || phase === "A" && (!modeLocked || phaseALocked === "LEFT_RIGHT");
	const canExecuteTranslation = isAvailableShip && selectedDirection && translateValue > 0;
	const canExecuteRotation = isAvailableShip && phase === "B" && rotateValue !== 0;

	const resourceExhausted = phase === "DONE" ||
		(phase === "A" && phaseARemaining <= 0) ||
		(phase === "B" && turnRemaining <= 0) ||
		(phase === "C" && phaseCRemaining <= 0);

	// 方向标签映射
	const directionLabel: Record<string, string> = {
		forward: "前进",
		backward: "后退",
		left: "左移",
		right: "右移",
	};

	return (
		<Flex className="panel-row" gap="3">
			{/* 舰船标识区 */}
			<Flex className="panel-section panel-section--vertical" gap="1" style={{ minWidth: 100 }}>
				<Text size="5" weight="bold" style={{ color: "#cfe8ff", lineHeight: 1.2 }}>
					{hasShip ? (ship.metadata?.name ?? ship.$id.slice(-6)) : "请选择舰船"}
				</Text>
				<Flex align="center" gap="2">
					<Badge size="2" color={phase === "DONE" ? "gray" : phase === "B" ? "orange" : "green"}>
						Phase {phase}
					</Badge>
					{modeLocked && <Badge size="2" color="amber">锁定</Badge>}
				</Flex>
			</Flex>

			<Box className="panel-divider" />

			{/* Phase A/C: D-pad + 距离控制 */}
			{(phase === "A" || phase === "C") && (
				<>
					{/* D-pad 方向选择 */}
					<Flex className="panel-section" align="center" gap="3">
						<Box className="dpad-container">
							<button
								className={`dpad-btn dpad-btn--forward ${selectedDirection === "forward" ? "dpad-btn--active" : ""}`}
								onClick={() => handleDirectionSelect("forward")}
								disabled={!isAvailableShip || !canSelectForwardBackward}
								data-magnetic
								title="前进"
							>
								<ArrowUp size={20} />
							</button>
							<button
								className={`dpad-btn dpad-btn--left ${selectedDirection === "left" ? "dpad-btn--active" : ""}`}
								onClick={() => handleDirectionSelect("left")}
								disabled={!isAvailableShip || !canSelectLeftRight}
								data-magnetic
								title="左移"
							>
								<ArrowLeft size={20} />
							</button>
							<Box className="dpad-center">
								<Navigation size={20} />
							</Box>
							<button
								className={`dpad-btn dpad-btn--right ${selectedDirection === "right" ? "dpad-btn--active" : ""}`}
								onClick={() => handleDirectionSelect("right")}
								disabled={!isAvailableShip || !canSelectLeftRight}
								data-magnetic
								title="右移"
							>
								<ArrowRight size={20} />
							</button>
							<button
								className={`dpad-btn dpad-btn--reverse ${selectedDirection === "backward" ? "dpad-btn--active" : ""}`}
								onClick={() => handleDirectionSelect("backward")}
								disabled={!isAvailableShip || !canSelectForwardBackward}
								data-magnetic
								title="后退"
							>
								<ArrowDown size={20} />
							</button>
						</Box>

						{/* 已选方向的提示 */}
						<Flex direction="column" align="center" gap="1" style={{ minWidth: 48 }}>
							<Text size="6" style={{ color: selectedDirection ? "#4a9eff" : "#4a5568", fontWeight: 700 }}>
								{selectedDirection ? directionLabel[selectedDirection] : "—"}
							</Text>
							<Text size="1" style={{ color: "#6b8aaa" }}>
								{selectedDirection ? (phase === "A" ? "Phase A" : "Phase C") : "未选择"}
							</Text>
						</Flex>
					</Flex>

					{/* 距离滑动控制 */}
					{selectedDirection && (
						<Flex className="panel-section" align="center" gap="3" style={{ minWidth: 240, flex: 1 }}>
							<Text size="3" weight="bold" style={{ color: "#cfe8ff", minWidth: 36 }}>
								{translateValue}
							</Text>
							<input
								type="range"
								min={0}
								max={phase === "A" ? phaseARemaining : phaseCRemaining}
								step={5}
								value={translateValue}
								onChange={(e) => handleTranslateChange(Number(e.target.value))}
								disabled={!isAvailableShip}
								style={{ flex: 1, minWidth: 120 }}
							/>
							<TextField.Root
								size="2"
								value={translateValue.toString()}
								onChange={(e) => handleTranslateChange(Number(e.target.value) || 0)}
								style={{ width: 60 }}
								disabled={!isAvailableShip}
							/>
							<Button size="2" variant="solid" color="green" onClick={handleExecute} disabled={!canExecuteTranslation} data-magnetic>
								<Check size={16} /> 执行
							</Button>
						</Flex>
					)}
				</>
			)}

			{/* Phase B: 旋转控制 */}
			{phase === "B" && (
				<Flex className="panel-section" align="center" gap="3" style={{ flex: 1 }}>
					<RotateCw size={22} style={{ color: "#ffaa00" }} />
					<Text size="3" weight="bold" style={{ color: "#cfe8ff", minWidth: 36 }}>
						{rotateValue}°
					</Text>
					<input
						type="range"
						min={-turnRemaining}
						max={turnRemaining}
						step={5}
						value={rotateValue}
						onChange={(e) => handleRotateChange(Number(e.target.value))}
						disabled={!isAvailableShip}
						style={{ flex: 1, minWidth: 120 }}
					/>
					<TextField.Root
						size="2"
						value={rotateValue.toString()}
						onChange={(e) => handleRotateChange(Number(e.target.value) || 0)}
						style={{ width: 60 }}
						disabled={!isAvailableShip}
					/>
					<Text size="2" weight="bold" style={{ color: rotateValue > 0 ? "#4a9eff" : rotateValue < 0 ? "#ff6f8f" : "#4a5568", minWidth: 40 }}>
						{rotateValue > 0 ? "右转" : rotateValue < 0 ? "左转" : "—"}
					</Text>
					<Button size="2" variant="solid" color="green" onClick={handleExecute} disabled={!canExecuteRotation} data-magnetic>
						<Check size={16} /> 执行
					</Button>
				</Flex>
			)}

			<Box className="panel-divider" />

			{/* 右侧：资源 + 操作 */}
			<Flex className="panel-section panel-section--vertical" gap="1" style={{ minWidth: 80 }}>
				<Text size="1" style={{ color: "#6b8aaa" }}>剩余</Text>
				<Text size="5" weight="bold" style={{ color: "#cfe8ff" }}>
					{phase === "A" ? phaseARemaining : phase === "B" ? turnRemaining : phaseCRemaining}
				</Text>
				<Text size="1" style={{ color: "#6b8aaa" }}>
					{phase === "A" ? "速度" : phase === "B" ? "转向" : "速度"}
				</Text>
			</Flex>

			<Button size="2" variant="soft" color="orange" onClick={handleAdvancePhase} disabled={!isAvailableShip || resourceExhausted} data-magnetic style={{ height: 48, padding: "0 16px" }}>
				<ChevronRight size={18} /> 推进阶段
			</Button>
		</Flex>
	);
};

export default MovementPanel;
