/**
 * MovementPanel - 移动控制面板（ABC 阶段系统）
 *
 * 阶段设计：
 * - A阶段：平移（选择前后或左右之一，选定后锁定方向类型）
 * - B阶段：旋转（消耗总角度资源）
 * - C阶段：平移（选择前后或左右之一，选定后锁定方向类型）
 * - 顺序：A → B → C，不可逆
 *
 * 资源：
 * - A/C 阶段各自有独立资源（phaseARemaining / phaseCRemaining），最大值都是 maxSpeed
 * - 方向锁定：一旦在 A/C 阶段选择前后或左右，就锁定该方向类型
 * - 同阶段可多次移动：锁定后可在该方向类型内多次移动
 */

import React, { useState, useCallback, useEffect } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, RotateCw, Check, ChevronRight } from "lucide-react";
import { Button, Flex, Box, Text, Badge, Progress } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useUIStore } from "@/state/stores/uiStore";
import { useSelectedShip } from "@/hooks/useSelectedShip";
import "./battle-panel-row.css";

type PhaseType = "A" | "B" | "C";
type TranslationLock = "FORWARD_BACKWARD" | "LEFT_RIGHT" | null;

const PHASE_CONFIG: Record<PhaseType, { label: string; color: "green" | "amber" | "blue" }> = {
	A: { label: "移动A", color: "green" },
	B: { label: "转向B", color: "amber" },
	C: { label: "移动C", color: "blue" },
};

export interface MovementPanelProps {
	canControl?: boolean;
}

export const MovementPanel: React.FC<MovementPanelProps> = ({ canControl = true }) => {
	const { isAvailable, sendMove, sendRotate, sendAdvancePhase } = useGameAction();
	const { setMovementPreview } = useUIStore();

	const ship = useSelectedShip();
	const hasShip = ship && ship.runtime;
	const movement = hasShip ? ship.runtime.movement : null;
	const currentPhase = movement?.currentPhase ?? "DONE";

	const phaseAUsed = movement?.phaseAUsed ?? 0;
	const phaseCUsed = movement?.phaseCUsed ?? 0;
	const turnUsed = movement?.turnAngleUsed ?? 0;

	const phaseALock = movement?.phaseALock as TranslationLock ?? null;
	const phaseCLock = movement?.phaseCLock as TranslationLock ?? null;

	const maxSpeed = hasShip ? (ship.spec.maxSpeed ?? 100) : 100;
	const maxTurnRate = hasShip ? (ship.spec.maxTurnRate ?? 60) : 60;

	const phaseARemaining = maxSpeed - phaseAUsed;
	const phaseCRemaining = maxSpeed - phaseCUsed;
	const turnRemaining = maxTurnRate - turnUsed;

	// 当前阶段的锁定状态
	const currentPhaseLock = currentPhase === "A" ? phaseALock : currentPhase === "C" ? phaseCLock : null;
	const phaseRemaining = currentPhase === "A" ? phaseARemaining : currentPhase === "C" ? phaseCRemaining : 0;

	const canAct = canControl && hasShip && isAvailable && currentPhase !== "DONE";

	const [selectedDirection, setSelectedDirection] = useState<"forward" | "backward" | "left" | "right" | null>(null);
	const [translateValue, setTranslateValue] = useState(0);
	const [rotateValue, setRotateValue] = useState(0);

	useEffect(() => {
		setSelectedDirection(null);
		setTranslateValue(0);
		setRotateValue(0);
	}, [currentPhase, ship?.$id]);

	useEffect(() => {
		return () => setMovementPreview(null);
	}, [setMovementPreview]);

	const clearPreview = useCallback(() => setMovementPreview(null), [setMovementPreview]);

	const updatePreview = useCallback((direction: "forward" | "backward" | "left" | "right" | null, value: number) => {
		if (!hasShip) { clearPreview(); return; }
		let mode: "forward" | "strafe" = "forward";
		let actualValue = value;
		if (direction === "forward") { mode = "forward"; actualValue = Math.abs(value); }
		else if (direction === "backward") { mode = "forward"; actualValue = -Math.abs(value); }
		else if (direction === "right") { mode = "strafe"; actualValue = Math.abs(value); }
		else if (direction === "left") { mode = "strafe"; actualValue = -Math.abs(value); }
		setMovementPreview({
			shipId: ship.$id,
			phase: currentPhase,
			mode,
			value: actualValue,
			turn: 0,
			remaining: { forward: phaseARemaining, strafe: phaseCRemaining, turn: turnRemaining },
			directionLocked: Boolean(currentPhaseLock),
		});
	}, [hasShip, ship, currentPhase, phaseARemaining, phaseCRemaining, turnRemaining, currentPhaseLock, setMovementPreview, clearPreview]);

	const handleDirectionSelect = (direction: "forward" | "backward" | "left" | "right") => {
		setSelectedDirection(direction);
		setTranslateValue(0);
		updatePreview(direction, 0);
	};

	const handleTranslateChange = (value: number) => {
		const clamped = Math.max(0, Math.min(phaseRemaining, value));
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
		if (currentPhase === "A" || currentPhase === "C") {
			if (!selectedDirection || translateValue === 0) return;
			let forward = 0, strafe = 0;
			if (selectedDirection === "forward") forward = translateValue;
			else if (selectedDirection === "backward") forward = -translateValue;
			else if (selectedDirection === "right") strafe = translateValue;
			else if (selectedDirection === "left") strafe = -translateValue;
			await sendMove(ship.$id, forward, strafe);
			setSelectedDirection(null);
			setTranslateValue(0);
		} else if (currentPhase === "B") {
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

	// 方向可用性检查
	const canForwardBackward = canAct && (currentPhase === "A" || currentPhase === "C") && phaseRemaining > 0 && (!currentPhaseLock || currentPhaseLock === "FORWARD_BACKWARD");
	const canLeftRight = canAct && (currentPhase === "A" || currentPhase === "C") && phaseRemaining > 0 && (!currentPhaseLock || currentPhaseLock === "LEFT_RIGHT");

	if (!hasShip) {
		return (
			<Box className="battle-row battle-row--empty">
				<Text size="2" color="gray">选择舰船后可移动</Text>
			</Box>
		);
	}

	const isDone = currentPhase === "DONE";

	return (
		<Box className="battle-row">
			{/* ====== 左列：三阶段状态 ====== */}
			<Box className="battle-col" style={{ flex: 1.2, minWidth: 120 }}>
				<Box className="battle-col__header">
					<Text size="1" weight="bold">阶段</Text>
				</Box>
				<Box className="battle-col__content" style={{ flexDirection: "column", gap: 4, padding: "6px 8px" }}>
					{/* A 阶段 */}
					<Box style={{
						display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
						background: currentPhase === "A" ? "rgba(74, 158, 255, 0.15)" : isDone ? "rgba(10, 20, 30, 0.3)" : "rgba(10, 25, 50, 0.5)",
						border: currentPhase === "A" ? "1px solid rgba(74, 158, 255, 0.5)" : "1px solid rgba(43, 66, 97, 0.3)",
						borderRadius: 4, opacity: isDone ? 0.5 : 1,
					}}>
						<Badge size="1" color={currentPhase === "A" ? "green" : "gray"} style={{ fontWeight: "bold", minWidth: 50 }}>Phase A</Badge>
						<Box style={{ flex: 1 }}>
							<Progress value={maxSpeed > 0 ? (phaseARemaining / maxSpeed) * 100 : 0} color={currentPhase === "A" ? "green" : "gray"} style={{ height: 6, borderRadius: 2 }} />
						</Box>
						<Text size="1" style={{ color: currentPhase === "A" ? "#cfe8ff" : "#6b8aaa", minWidth: 30 }}>{phaseARemaining}m</Text>
						{phaseALock && <Badge size="1" color="orange">{phaseALock === "FORWARD_BACKWARD" ? "前后" : "左右"}</Badge>}
					</Box>

					{/* B 阶段 */}
					<Box style={{
						display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
						background: currentPhase === "B" ? "rgba(74, 158, 255, 0.15)" : isDone ? "rgba(10, 20, 30, 0.3)" : "rgba(10, 25, 50, 0.5)",
						border: currentPhase === "B" ? "1px solid rgba(74, 158, 255, 0.5)" : "1px solid rgba(43, 66, 97, 0.3)",
						borderRadius: 4, opacity: isDone ? 0.5 : 1,
					}}>
						<Badge size="1" color={currentPhase === "B" ? "amber" : "gray"} style={{ fontWeight: "bold", minWidth: 50 }}>Phase B</Badge>
						<Box style={{ flex: 1 }}>
							<Progress value={maxTurnRate > 0 ? (turnRemaining / maxTurnRate) * 100 : 0} color={currentPhase === "B" ? "amber" : "gray"} style={{ height: 6, borderRadius: 2 }} />
						</Box>
						<Text size="1" style={{ color: currentPhase === "B" ? "#cfe8ff" : "#6b8aaa", minWidth: 30 }}>{turnRemaining}°</Text>
					</Box>

					{/* C 阶段 */}
					<Box style={{
						display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
						background: currentPhase === "C" ? "rgba(74, 158, 255, 0.15)" : isDone ? "rgba(10, 20, 30, 0.3)" : "rgba(10, 25, 50, 0.5)",
						border: currentPhase === "C" ? "1px solid rgba(74, 158, 255, 0.5)" : "1px solid rgba(43, 66, 97, 0.3)",
						borderRadius: 4, opacity: isDone ? 0.5 : 1,
					}}>
						<Badge size="1" color={currentPhase === "C" ? "blue" : "gray"} style={{ fontWeight: "bold", minWidth: 50 }}>Phase C</Badge>
						<Box style={{ flex: 1 }}>
							<Progress value={maxSpeed > 0 ? (phaseCRemaining / maxSpeed) * 100 : 0} color={currentPhase === "C" ? "blue" : "gray"} style={{ height: 6, borderRadius: 2 }} />
						</Box>
						<Text size="1" style={{ color: currentPhase === "C" ? "#cfe8ff" : "#6b8aaa", minWidth: 30 }}>{phaseCRemaining}m</Text>
						{phaseCLock && <Badge size="1" color="orange">{phaseCLock === "FORWARD_BACKWARD" ? "前后" : "左右"}</Badge>}
					</Box>
				</Box>
			</Box>

			<Box className="battle-divider" />

			{/* ====== 中列：操作区 ====== */}
			<Box className="battle-col" style={{ flex: 1, minWidth: 100 }}>
				<Box className="battle-col__header">
					<Flex align="center" gap="2">
						<Text size="1" weight="bold">
							{isDone ? "完成" : PHASE_CONFIG[currentPhase as PhaseType]?.label ?? ""}
						</Text>
						{currentPhase === "A" && phaseALock && <Badge size="1" color="orange">已锁定{phaseALock === "FORWARD_BACKWARD" ? "前后" : "左右"}</Badge>}
						{currentPhase === "C" && phaseCLock && <Badge size="1" color="orange">已锁定{phaseCLock === "FORWARD_BACKWARD" ? "前后" : "左右"}</Badge>}
					</Flex>
				</Box>
				<Box className="battle-col__content battle-col__content--horizontal" style={{ padding: "8px 6px" }}>
					{isDone ? (
						<Text size="2" color="gray">本回合移动完成</Text>
					) : currentPhase === "A" || currentPhase === "C" ? (
						<>
							{/* 前后按钮 */}
							<Button size="2" variant={selectedDirection === "forward" ? "solid" : "soft"} color="green" onClick={() => handleDirectionSelect("forward")} disabled={!canForwardBackward} title="前进">
								<ArrowUp size={14} />
							</Button>
							<Button size="2" variant={selectedDirection === "backward" ? "solid" : "soft"} color="green" onClick={() => handleDirectionSelect("backward")} disabled={!canForwardBackward} title="后退">
								<ArrowDown size={14} />
							</Button>
							{/* 左右按钮 */}
							<Button size="2" variant={selectedDirection === "left" ? "solid" : "soft"} color="blue" onClick={() => handleDirectionSelect("left")} disabled={!canLeftRight} title="左移">
								<ArrowLeft size={14} />
							</Button>
							<Button size="2" variant={selectedDirection === "right" ? "solid" : "soft"} color="blue" onClick={() => handleDirectionSelect("right")} disabled={!canLeftRight} title="右移">
								<ArrowRight size={14} />
							</Button>
							{selectedDirection && (
								<>
									<input type="range" min={0} max={phaseRemaining} step={5} value={translateValue} onChange={(e) => handleTranslateChange(Number(e.target.value))} disabled={!canAct} style={{ width: 80 }} />
									<Text size="1" weight="bold" style={{ color: "#cfe8ff" }}>{translateValue}m</Text>
								</>
							)}
						</>
					) : currentPhase === "B" ? (
						<>
							<Button size="2" variant="soft" onClick={() => handleRotateChange(rotateValue - 15)} disabled={!canAct}>
								<RotateCcw size={14} />
							</Button>
							<input type="range" min={-turnRemaining} max={turnRemaining} step={5} value={rotateValue} onChange={(e) => handleRotateChange(Number(e.target.value))} disabled={!canAct} style={{ width: 80 }} />
							<Button size="2" variant="soft" onClick={() => handleRotateChange(rotateValue + 15)} disabled={!canAct}>
								<RotateCw size={14} />
							</Button>
							<Text size="1" weight="bold" style={{ color: rotateValue > 0 ? "#4a9eff" : rotateValue < 0 ? "#ff6f8f" : "#6b8aaa" }}>
								{rotateValue}°
							</Text>
						</>
					) : null}
				</Box>
			</Box>

			<Box className="battle-divider" />

			{/* ====== 右列：执行 + 推进按钮 ====== */}
			<Box className="battle-col battle-col--narrow" style={{ maxWidth: 70, padding: 0 }}>
				<Box style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, padding: "6px 4px" }}>
					<Button
						size="2"
						variant="solid"
						color={currentPhase === "B" ? "amber" : currentPhase === "C" ? "blue" : "green"}
						onClick={handleExecute}
						disabled={!canAct || isDone || (currentPhase !== "B" && (!selectedDirection || translateValue === 0)) || (currentPhase === "B" && rotateValue === 0)}
						style={{ flex: 1, minHeight: 50 }}
					>
						<Check size={16} />
					</Button>
					<Button
						size="2"
						variant="soft"
						color="amber"
						onClick={handleAdvancePhase}
						disabled={!canAct || isDone}
						style={{ flex: 1, minHeight: 50 }}
					>
						<ChevronRight size={16} />
					</Button>
				</Box>
			</Box>
		</Box>
	);
};

export default MovementPanel;