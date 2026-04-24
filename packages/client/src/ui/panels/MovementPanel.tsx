/**
 * 移动面板 - 方向选择 + 滑动条预览 + 执行
 * 
 * Phase A/C：选择方向（前/后/左/右），调整距离，确认执行
 * Phase B：旋转滑动条 + 执行
 */

import React, { useState, useCallback, useEffect } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCw, Check, ChevronRight } from "lucide-react";
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

	return (
		<Flex className="panel-row" gap="3">
			<Flex className="panel-section" align="center" gap="2">
				<Text size="2" weight="bold">{hasShip ? (ship.metadata?.name ?? ship.$id.slice(-6)) : "请选择舰船"}</Text>
				<Badge size="1" color={phase === "DONE" ? "gray" : phase === "B" ? "orange" : "green"}>
					Phase {phase}
				</Badge>
				{modeLocked && <Badge size="1" color="amber">锁定</Badge>}
			</Flex>

			<Box className="panel-divider" />

			{(phase === "A" || phase === "C") && (
				<>
					<Flex className="panel-section" align="center" gap="1">
						<Button
							size="1"
							variant={selectedDirection === "forward" ? "solid" : "soft"}
							color="green"
							onClick={() => handleDirectionSelect("forward")}
							disabled={!isAvailableShip || !canSelectForwardBackward}
							style={{ width: 32, height: 32 }}
							data-magnetic
						>
							<ArrowUp size={14} />
						</Button>
						<Button
							size="1"
							variant={selectedDirection === "backward" ? "solid" : "soft"}
							color="red"
							onClick={() => handleDirectionSelect("backward")}
							disabled={!isAvailableShip || !canSelectForwardBackward}
							style={{ width: 32, height: 32 }}
							data-magnetic
						>
							<ArrowDown size={14} />
						</Button>
						<Button
							size="1"
							variant={selectedDirection === "left" ? "solid" : "soft"}
							color="blue"
							onClick={() => handleDirectionSelect("left")}
							disabled={!isAvailableShip || !canSelectLeftRight}
							style={{ width: 32, height: 32 }}
							data-magnetic
						>
							<ArrowLeft size={14} />
						</Button>
						<Button
							size="1"
							variant={selectedDirection === "right" ? "solid" : "soft"}
							color="blue"
							onClick={() => handleDirectionSelect("right")}
							disabled={!isAvailableShip || !canSelectLeftRight}
							style={{ width: 32, height: 32 }}
						>
							<ArrowRight size={14} />
						</Button>
					</Flex>

					{selectedDirection && (
						<>
							<Box className="panel-divider" />

							<Flex className="panel-section" align="center" gap="2">
								<Text size="1" color="gray">
									{selectedDirection === "forward" ? "前进" :
										selectedDirection === "backward" ? "后退" :
											selectedDirection === "left" ? "左移" : "右移"}
								</Text>
								<input
									type="range"
									min={0}
									max={phase === "A" ? phaseARemaining : phaseCRemaining}
									step={5}
									value={translateValue}
									onChange={(e) => handleTranslateChange(Number(e.target.value))}
									disabled={!isAvailableShip}
									style={{ width: 100 }}
								/>
								<TextField.Root
									size="1"
									value={translateValue.toString()}
									onChange={(e) => handleTranslateChange(Number(e.target.value) || 0)}
									style={{ width: 50 }}
									disabled={!isAvailableShip}
								/>
							</Flex>

							<Box className="panel-divider" />

							<Button size="1" variant="solid" color="green" onClick={handleExecute} disabled={!canExecuteTranslation} data-magnetic>
								<Check size={12} /> 执行
							</Button>
						</>
					)}
				</>
			)}

			{phase === "B" && (
				<>
					<Flex className="panel-section" align="center" gap="2">
						<RotateCw size={14} />
						<Text size="1" className="panel-section__label">转向</Text>
						<input
							type="range"
							min={-turnRemaining}
							max={turnRemaining}
							step={5}
							value={rotateValue}
							onChange={(e) => handleRotateChange(Number(e.target.value))}
							disabled={!isAvailableShip}
							style={{ width: 100 }}
						/>
						<TextField.Root
							size="1"
							value={rotateValue.toString()}
							onChange={(e) => handleRotateChange(Number(e.target.value) || 0)}
							style={{ width: 50 }}
							disabled={!isAvailableShip}
						/>
						<Text size="1" color="gray">
							{rotateValue > 0 ? "右转" : rotateValue < 0 ? "左转" : ""}
						</Text>
					</Flex>

					<Box className="panel-divider" />

					<Button size="1" variant="solid" color="green" onClick={handleExecute} disabled={!canExecuteRotation} data-magnetic>
						<Check size={12} /> 执行
					</Button>
				</>
			)}

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Text size="1" color="gray">
					剩余: {phase === "A" ? phaseARemaining : phase === "B" ? turnRemaining : phaseCRemaining}
				</Text>
			</Flex>

			<Button size="1" variant="soft" color="orange" onClick={handleAdvancePhase} disabled={!isAvailableShip || resourceExhausted} data-magnetic>
				<ChevronRight size={12} /> 推进
			</Button>
		</Flex>
	);
};

export default MovementPanel;