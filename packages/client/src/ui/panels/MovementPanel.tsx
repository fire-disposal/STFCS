import React, { useState, useCallback, useEffect } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw, RotateCw, Check, ChevronRight, Info } from "lucide-react";
import { Button, Flex, Box, Text, Badge, Progress } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useUIStore } from "@/state/stores/uiStore";
import { useSelectedShip } from "@/hooks/useSelectedShip";
import "./battle-panel-row.css";

type PhaseType = "A" | "B" | "C";
type TranslationLock = "FORWARD_BACKWARD" | "LEFT_RIGHT" | null;

const PHASE_INFO: Record<PhaseType, { label: string; color: "green" | "amber" | "blue"; desc: string }> = {
	A: { label: "移动 A", color: "green", desc: "平移（前后或左右）" },
	B: { label: "转向 B", color: "amber", desc: "原地旋转" },
	C: { label: "移动 C", color: "blue", desc: "平移（前后或左右）" },
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

	const currentPhaseLock = currentPhase === "A" ? phaseALock : currentPhase === "C" ? phaseCLock : null;
	const phaseRemaining = currentPhase === "A" ? phaseARemaining : currentPhase === "C" ? phaseCRemaining : 0;

	const destroyed = hasShip ? ship.runtime.destroyed : false;
	const canAct = canControl && hasShip && !destroyed && isAvailable() && currentPhase !== "DONE";

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

	const canForwardBackward = canAct && (currentPhase === "A" || currentPhase === "C") && phaseRemaining > 0 && (!currentPhaseLock || currentPhaseLock === "FORWARD_BACKWARD");
	const canLeftRight = canAct && (currentPhase === "A" || currentPhase === "C") && phaseRemaining > 0 && (!currentPhaseLock || currentPhaseLock === "LEFT_RIGHT");

	if (!hasShip) {
		return (
			<Box className="battle-row battle-row--empty">
				<Text size="2" color="gray">点击选择舰船</Text>
			</Box>
		);
	}

	const isDone = currentPhase === "DONE";
	const phases: PhaseType[] = ["A", "B", "C"];

	return (
		<Box className="battle-row">
			<Box className="battle-col" style={{ flex: 1, minWidth: 140 }}>
				<Box className="battle-col__header">
					<Flex align="center" gap="2">
						<Text size="1" weight="bold">阶段进度</Text>
						<Text size="1" color="gray">航速 {maxSpeed}m · 转向 {maxTurnRate}°</Text>
					</Flex>
				</Box>
				<Box className="battle-col__content" style={{ flexDirection: "column", gap: 3, padding: "4px 8px" }}>
					{phases.map((p) => {
						const info = PHASE_INFO[p];
						const isActive = currentPhase === p;
						const isPast = phases.indexOf(p) < phases.indexOf(currentPhase as PhaseType);
						const remaining = p === "A" ? phaseARemaining : p === "C" ? phaseCRemaining : turnRemaining;
						const max = p === "B" ? maxTurnRate : maxSpeed;
						const unit = p === "B" ? "°" : "m";
						const lock = p === "A" ? phaseALock : p === "C" ? phaseCLock : null;
						return (
							<Flex key={p} align="center" gap="2" style={{
								padding: "4px 8px",
								background: isActive ? "rgba(74, 158, 255, 0.12)" : "transparent",
								border: isActive ? "1px solid rgba(74, 158, 255, 0.4)" : "1px solid transparent",
								borderRadius: 4,
								opacity: isDone || isPast ? 0.5 : 1,
							}}>
								<Badge size="1" color={isActive ? info.color : "gray"} style={{ minWidth: 24, justifyContent: "center" }}>{p}</Badge>
								<Box style={{ flex: 1, minWidth: 0 }}>
									<Flex justify="between" align="center">
										<Text size="1" style={{ color: isActive ? "#cfe8ff" : "#6b8aaa" }}>{info.desc}</Text>
										<Text size="1" style={{ color: isActive ? "#cfe8ff" : "#6b8aaa" }}>{remaining}{unit}</Text>
									</Flex>
									<Progress value={max > 0 ? (remaining / max) * 100 : 0} color={isActive ? info.color : "gray"} style={{ height: 4, borderRadius: 2, marginTop: 2 }} />
								</Box>
								{lock && <Badge size="1" color="orange" variant="soft">{lock === "FORWARD_BACKWARD" ? "前后" : "左右"}</Badge>}
							</Flex>
						);
					})}
					{isDone && (
						<Flex align="center" gap="2" style={{ padding: "4px 8px" }}>
							<Badge size="1" color="gray">✓</Badge>
							<Text size="1" color="gray">
								移动 {phaseAUsed + phaseCUsed}m · 转向 {turnUsed}°
							</Text>
						</Flex>
					)}
				</Box>
			</Box>

			<Box className="battle-divider" />

			<Box className="battle-col" style={{ flex: 1.2, minWidth: 160 }}>
				<Box className="battle-col__header">
					<Flex align="center" gap="2">
						<Text size="1" weight="bold">
							{isDone ? "移动完成" : PHASE_INFO[currentPhase as PhaseType]?.label ?? ""}
						</Text>
						{currentPhaseLock && <Badge size="1" color="orange" variant="soft">已锁定{currentPhaseLock === "FORWARD_BACKWARD" ? "前后" : "左右"}</Badge>}
					</Flex>
				</Box>
				<Box className="battle-col__content" style={{ padding: "6px 8px" }}>
					{isDone ? (
						<Flex direction="column" align="center" justify="center" gap="1" style={{ height: "100%" }}>
							<Text size="1" color="gray">本回合移动已完成</Text>
							<Text size="1" color="gray">等待其他玩家行动</Text>
						</Flex>
					) : currentPhase === "A" || currentPhase === "C" ? (
						<Flex direction="column" gap="2" style={{ height: "100%" }}>
							<Flex align="center" gap="2">
								<Flex direction="column" align="center" gap="1">
									<Button size="1" variant={selectedDirection === "forward" ? "solid" : "soft"} color="green" onClick={() => handleDirectionSelect("forward")} disabled={!canForwardBackward} title="前进" style={{ width: 32, height: 28 }}>
										<ArrowUp size={13} />
									</Button>
									<Flex gap="1">
										<Button size="1" variant={selectedDirection === "left" ? "solid" : "soft"} color="blue" onClick={() => handleDirectionSelect("left")} disabled={!canLeftRight} title="左移" style={{ width: 32, height: 28 }}>
											<ArrowLeft size={13} />
										</Button>
										<Button size="1" variant={selectedDirection === "right" ? "solid" : "soft"} color="blue" onClick={() => handleDirectionSelect("right")} disabled={!canLeftRight} title="右移" style={{ width: 32, height: 28 }}>
											<ArrowRight size={13} />
										</Button>
									</Flex>
									<Button size="1" variant={selectedDirection === "backward" ? "solid" : "soft"} color="green" onClick={() => handleDirectionSelect("backward")} disabled={!canForwardBackward} title="后退" style={{ width: 32, height: 28 }}>
										<ArrowDown size={13} />
									</Button>
								</Flex>

								{selectedDirection ? (
									<Flex direction="column" gap="1" style={{ flex: 1 }}>
										<Flex align="center" gap="2">
											<input type="range" min={0} max={phaseRemaining} step={5} value={translateValue} onChange={(e) => handleTranslateChange(Number(e.target.value))} disabled={!canAct} style={{ flex: 1 }} />
											<input type="number" value={translateValue} onChange={(e) => handleTranslateChange(Number(e.target.value))} disabled={!canAct} style={{ width: 48, textAlign: "center", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(43,66,97,0.6)", borderRadius: 4, color: "#cfe8ff", fontSize: 11, padding: "2px 4px" }} />
											<Text size="1" color="gray">m</Text>
										</Flex>
										<Text size="1" color="gray">剩余 {phaseRemaining}m · 步进 5m</Text>
									</Flex>
								) : (
									<Flex align="center" style={{ flex: 1 }}>
										<Flex align="center" gap="1">
											<Info size={12} style={{ color: "#4a6a8a", flexShrink: 0 }} />
											<Text size="1" color="gray">选择方向开始移动，锁定后仅限同类方向</Text>
										</Flex>
									</Flex>
								)}
							</Flex>
						</Flex>
					) : currentPhase === "B" ? (
						<Flex direction="column" gap="2" style={{ height: "100%" }}>
							<Flex align="center" gap="2">
								<Button size="1" variant="soft" onClick={() => handleRotateChange(rotateValue - 15)} disabled={!canAct} title="逆时针 15°">
									<RotateCcw size={13} />
								</Button>
								<Flex direction="column" gap="1" style={{ flex: 1 }}>
									<Flex align="center" gap="2">
										<input type="range" min={-turnRemaining} max={turnRemaining} step={5} value={rotateValue} onChange={(e) => handleRotateChange(Number(e.target.value))} disabled={!canAct} style={{ flex: 1 }} />
										<input type="number" value={rotateValue} onChange={(e) => handleRotateChange(Number(e.target.value))} disabled={!canAct} style={{ width: 48, textAlign: "center", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(43,66,97,0.6)", borderRadius: 4, color: "#cfe8ff", fontSize: 11, padding: "2px 4px" }} />
										<Text size="1" style={{ color: rotateValue > 0 ? "#4a9eff" : rotateValue < 0 ? "#ff6f8f" : "#6b8aaa" }}>°</Text>
									</Flex>
									<Text size="1" color="gray">剩余 {turnRemaining}° · {rotateValue > 0 ? "顺时针" : rotateValue < 0 ? "逆时针" : "步进 5°"}</Text>
								</Flex>
								<Button size="1" variant="soft" onClick={() => handleRotateChange(rotateValue + 15)} disabled={!canAct} title="顺时针 15°">
									<RotateCw size={13} />
								</Button>
							</Flex>
						</Flex>
					) : null}
				</Box>
			</Box>

			<Box className="battle-divider" />

			<Box className="battle-col" style={{ maxWidth: 90, minWidth: 80 }}>
				<Box className="battle-col__header">
					<Text size="1" weight="bold">操作</Text>
				</Box>
				<Box className="battle-col__content" style={{ flexDirection: "column", gap: 4, padding: "6px 4px" }}>
					<Button
						size="2"
						variant="solid"
						color={currentPhase === "B" ? "amber" : currentPhase === "C" ? "blue" : "green"}
						onClick={handleExecute}
						disabled={!canAct || isDone || (currentPhase !== "B" && (!selectedDirection || translateValue === 0)) || (currentPhase === "B" && rotateValue === 0)}
						style={{ flex: 1 }}
					>
						<Check size={14} /> 执行
					</Button>
					<Button
						size="1"
						variant="soft"
						color="gray"
						onClick={handleAdvancePhase}
						disabled={!canAct || isDone}
						style={{ flex: 0.6 }}
					>
						<ChevronRight size={12} /> 跳过
					</Button>
				</Box>
			</Box>
		</Box>
	);
};

export default MovementPanel;
