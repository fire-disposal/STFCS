/**
 * MovementPanel - 移动面板（优化版）
 *
 * 设计优化：
 * - 移除舰船标识区（顶栏已显示）
 * - 紧凑的 D-pad + 资源显示
 * - 使用 SliderInput 统一控制
 * - 合理的字号比例
 */

import React, { useState, useCallback, useEffect } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCw, ChevronRight, Check } from "lucide-react";
import { Button, Flex, Box, Text, Badge } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useUIStore } from "@/state/stores/uiStore";
import { useSelectedShip } from "@/hooks/useSelectedShip";
import SliderInput from "@/ui/shared/SliderInput";
import "./battle-panel.css";

type Direction = "forward" | "backward" | "left" | "right" | null;

export interface MovementPanelProps {
	canControl?: boolean;
}

export const MovementPanel: React.FC<MovementPanelProps> = ({ canControl = true }) => {
	const { isAvailable, sendMove, sendRotate, sendAdvancePhase } = useGameAction();
	const { setMovementPreview } = useUIStore();

	const ship = useSelectedShip();
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

	const canAct = canControl && hasShip && isAvailable && phase !== "DONE";

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

	const clearPreview = useCallback(() => setMovementPreview(null), [setMovementPreview]);

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
			remaining: { forward: phaseARemaining, strafe: phaseCRemaining, turn: turnRemaining },
			directionLocked: Boolean(modeLocked),
		});
	}, [hasShip, ship, phase, phaseARemaining, phaseCRemaining, turnRemaining, modeLocked, setMovementPreview, clearPreview]);

	const handleDirectionSelect = (direction: Direction) => {
		const phaseLocked = phase === "A" ? movement?.phaseALock : movement?.phaseCLock;
		if (phaseLocked) {
			const isForwardBackward = phaseLocked === "FORWARD_BACKWARD";
			const isValid = isForwardBackward
				? (direction === "forward" || direction === "backward")
				: (direction === "left" || direction === "right");
			if (!isValid) return;
		}
		setSelectedDirection(direction);
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
			remaining: { forward: phaseARemaining, strafe: phaseCRemaining, turn: turnRemaining },
			directionLocked: false,
		});
	};

	const handleExecute = async () => {
		if (!canAct) return;
		clearPreview();

		if (phase === "A" || phase === "C") {
			if (!selectedDirection || translateValue === 0) return;

			let forward = 0, strafe = 0;
			if (selectedDirection === "forward") forward = translateValue;
			else if (selectedDirection === "backward") forward = -translateValue;
			else if (selectedDirection === "right") strafe = translateValue;
			else if (selectedDirection === "left") strafe = -translateValue;

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
		if (!canAct) return;
		clearPreview();
		setSelectedDirection(null);
		setTranslateValue(0);
		setRotateValue(0);
		await sendAdvancePhase(ship.$id);
	};

	const canSelectForwardBackward = phase === "A" && (!modeLocked || movement?.phaseALock === "FORWARD_BACKWARD");
	const canSelectLeftRight = phase === "C" && (!modeLocked || movement?.phaseCLock === "LEFT_RIGHT") ||
		phase === "A" && (!modeLocked || movement?.phaseALock === "LEFT_RIGHT");

	const resourceExhausted = phase === "DONE" ||
		(phase === "A" && phaseARemaining <= 0) ||
		(phase === "B" && turnRemaining <= 0) ||
		(phase === "C" && phaseCRemaining <= 0);

	const remaining = phase === "A" ? phaseARemaining : phase === "B" ? turnRemaining : phaseCRemaining;
	const remainingLabel = phase === "B" ? "转向" : "速度";

	// 方向箭头组件
	const DirectionBtn = ({ dir, icon, disabled }: { dir: Direction; icon: React.ReactNode; disabled: boolean }) => (
		<button
			className={`dpad-btn dpad-btn--${dir} ${selectedDirection === dir ? "dpad-btn--active" : ""}`}
			onClick={() => handleDirectionSelect(dir)}
			disabled={disabled || !canAct}
			style={{ width: 36, height: 36 }}
		>
			{icon}
		</button>
	);

	// 空状态
	if (!hasShip) {
		return (
			<Flex className="panel-row" align="center" gap="3">
				<Text size="2" color="gray">选择舰船后可移动</Text>
			</Flex>
		);
	}

	return (
		<Flex className="panel-row" gap="3" align="center">
			{/* Phase 状态 */}
			<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 80 }}>
				<Badge size="2" color={phase === "DONE" ? "gray" : phase === "B" ? "amber" : "green"}>
					Phase {phase}
				</Badge>
				{modeLocked && <Badge size="1" color="orange">锁定</Badge>}
			</Flex>

			<Box className="panel-divider" />

			{/* Phase A/C: D-pad */}
			{(phase === "A" || phase === "C") && (
				<>
					<Box className="dpad-container" style={{ gap: 2 }}>
						<DirectionBtn dir="forward" icon={<ArrowUp size={16} />} disabled={!canSelectForwardBackward} />
						<DirectionBtn dir="left" icon={<ArrowLeft size={16} />} disabled={!canSelectLeftRight} />
						<Box className="dpad-center" style={{ fontSize: 9 }}>
							{selectedDirection ? (selectedDirection === "forward" ? "↑" : selectedDirection === "backward" ? "↓" : selectedDirection === "left" ? "←" : "→") : "—"}
						</Box>
						<DirectionBtn dir="right" icon={<ArrowRight size={16} />} disabled={!canSelectLeftRight} />
						<DirectionBtn dir="backward" icon={<ArrowDown size={16} />} disabled={!canSelectForwardBackward} />
					</Box>

					<Box className="panel-divider" />

					{/* 移动距离控制 */}
					{selectedDirection && (
						<Flex className="panel-section" align="center" gap="2">
							<SliderInput
								value={translateValue}
								min={0}
								max={phase === "A" ? phaseARemaining : phaseCRemaining}
								step={5}
								onChange={handleTranslateChange}
								disabled={!canAct}
								unit="m"
								width={180}
							/>
							<Button size="2" variant="solid" color="green" onClick={handleExecute}
								disabled={!canAct || translateValue === 0}>
								<Check size={14} /> 执行
							</Button>
						</Flex>
					)}
				</>
			)}

			{/* Phase B: 旋转 */}
			{phase === "B" && (
				<Flex className="panel-section" align="center" gap="2">
					<RotateCw size={16} style={{ color: "#ffaa00" }} />
					<SliderInput
						value={rotateValue}
						min={-turnRemaining}
						max={turnRemaining}
						step={5}
						onChange={handleRotateChange}
						disabled={!canAct}
						unit="°"
						width={160}
					/>
					<Text size="1" weight="bold" style={{
						color: rotateValue > 0 ? "#4a9eff" : rotateValue < 0 ? "#ff6f8f" : "#6b8aaa",
						minWidth: 24,
					}}>
						{rotateValue > 0 ? "右" : rotateValue < 0 ? "左" : "—"}
					</Text>
					<Button size="2" variant="solid" color="green" onClick={handleExecute}
						disabled={!canAct || rotateValue === 0}>
						<Check size={14} /> 执行
					</Button>
				</Flex>
			)}

			<Box className="panel-divider" />

			{/* 剩余资源 */}
			<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 60 }}>
				<Text size="1" style={{ color: "#6b8aaa" }}>{remainingLabel}</Text>
				<Text size="3" weight="bold" style={{ color: remaining > 0 ? "#cfe8ff" : "#ff6f8f" }}>
					{remaining}
				</Text>
			</Flex>

			{/* 推进阶段 */}
			<Button size="2" variant="soft" color="amber" onClick={handleAdvancePhase}
				disabled={!canAct || resourceExhausted}>
				<ChevronRight size={14} /> 推进
			</Button>
		</Flex>
	);
};

export default MovementPanel;