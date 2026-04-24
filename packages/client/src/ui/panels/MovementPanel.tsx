import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronRight, Play } from "lucide-react";
import type { CombatToken } from "@vt/data";
import { Button, Flex, Box, Text, TextField, Badge } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useUIStore } from "@/state/stores/uiStore";
import "./battle-panel.css";

export interface MovementPanelProps {
	ship: CombatToken | null;
	canControl: boolean;
}

type TranslateMode = "forward" | "strafe";

export const MovementPanel: React.FC<MovementPanelProps> = ({ ship, canControl }) => {
	const [translateMode, setTranslateMode] = useState<TranslateMode>("forward");
	const [translateValue, setTranslateValue] = useState(0);
	const [rotateValue, setRotateValue] = useState(0);
	const [modeLocked, setModeLocked] = useState(false);

	const { isAvailable, sendMove, sendRotate, sendAdvancePhase } = useGameAction();
	const setMovementPreview = useUIStore((state) => state.setMovementPreview);

	const hasShip = ship && ship.runtime;
	const movement = hasShip ? ship.runtime.movement : undefined;
	const phase = movement?.currentPhase ?? "A";
	const hasMoved = movement?.hasMoved ?? false;
	const maxSpeed = hasShip ? (ship.spec.maxSpeed ?? 100) : 100;
	const maxTurnRate = hasShip ? (ship.spec.maxTurnRate ?? 30) : 30;

	const phaseAUsed = movement?.phaseAUsed ?? 0;
	const phaseCUsed = movement?.phaseCUsed ?? 0;
	const turnAngleUsed = movement?.turnAngleUsed ?? 0;

	const phaseARemaining = maxSpeed - phaseAUsed;
	const phaseCRemaining = maxSpeed - phaseCUsed;
	const turnRemaining = maxTurnRate - turnAngleUsed;

	const phaseALocked = movement?.phaseALock ?? false;
	const phaseCLocked = movement?.phaseCLock ?? false;

	const canAct = canControl && hasShip && isAvailable && phase !== "DONE";

	const updatePreview = useCallback((mode: TranslateMode | "turn", value: number) => {
		if (!hasShip) {
			setMovementPreview(null);
			return;
		}
		setMovementPreview({
			shipId: ship.$id,
			phase,
			mode: mode === "turn" ? translateMode : mode,
			value: mode === "turn" ? 0 : value,
			turn: mode === "turn" ? value : 0,
			remaining: {
				forward: phaseARemaining,
				strafe: phaseCRemaining,
				turn: turnRemaining,
			},
			directionLocked: Boolean(modeLocked || phaseALocked || phaseCLocked),
		});
	}, [hasShip, ship, phase, translateMode, phaseARemaining, phaseCRemaining, turnRemaining, modeLocked, phaseALocked, phaseCLocked, setMovementPreview]);

	const clearPreview = useCallback(() => {
		setMovementPreview(null);
	}, [setMovementPreview]);

	useEffect(() => {
		return () => clearPreview();
	}, [clearPreview]);

	// 执行当前阶段的操作
	const handleExecute = async () => {
		if (!canAct) return;
		clearPreview();
		
		if (phase === "A") {
			await sendMove(ship.$id, translateValue, 0);
			if (!modeLocked && translateValue !== 0) {
				setModeLocked(true);
			}
		} else if (phase === "B") {
			await sendRotate(ship.$id, rotateValue);
		} else if (phase === "C") {
			await sendMove(ship.$id, 0, translateValue);
			if (!modeLocked && translateValue !== 0) {
				setModeLocked(true);
			}
		}
		
		setTranslateValue(0);
		setRotateValue(0);
	};

	const handleAdvancePhase = async () => {
		if (!canAct) return;
		clearPreview();
		setModeLocked(false);
		setTranslateValue(0);
		setRotateValue(0);
		await sendAdvancePhase(ship.$id);
	};

	const handleTranslateModeChange = (newMode: TranslateMode) => {
		if (modeLocked) return;
		setTranslateMode(newMode);
		setTranslateValue(0);
		updatePreview(newMode, 0);
	};

	const handleTranslateValueChange = (value: number | string) => {
		const num = typeof value === "string" ? Number(value) || 0 : value;
		const maxRemaining = phase === "A" ? phaseARemaining : phaseCRemaining;
		const clamped = Math.max(-maxRemaining, Math.min(maxRemaining, num));
		setTranslateValue(clamped);
		updatePreview(translateMode, clamped);
	};

	const handleRotateValueChange = (value: number | string) => {
		const num = typeof value === "string" ? Number(value) || 0 : value;
		const clamped = Math.max(-turnRemaining, Math.min(turnRemaining, num));
		setRotateValue(clamped);
		updatePreview("turn", clamped);
	};

	// 执行按钮是否可用（资源耗尽时不可交互）
	const canExecute = useMemo(() => {
		if (!canAct) return false;
		if (phase === "A") return phaseARemaining > 0 && translateValue !== 0;
		if (phase === "B") return turnRemaining > 0 && rotateValue !== 0;
		if (phase === "C") return phaseCRemaining > 0 && translateValue !== 0;
		return false;
	}, [canAct, phase, phaseARemaining, phaseCRemaining, turnRemaining, translateValue, rotateValue]);

	// 当前阶段资源是否耗尽
	const resourceExhausted = useMemo(() => {
		if (phase === "A") return phaseARemaining <= 0;
		if (phase === "B") return turnRemaining <= 0;
		if (phase === "C") return phaseCRemaining <= 0;
		return false;
	}, [phase, phaseARemaining, phaseCRemaining, turnRemaining]);

	return (
		<Flex className="panel-row" gap="3" wrap="wrap">
			<Flex className="panel-section" align="center" gap="2">
				<Text size="2" weight="bold">{hasShip ? (ship.metadata?.name ?? ship.$id.slice(-6)) : "请选择舰船"}</Text>
				{hasMoved && <Badge size="1" color="amber">已移动</Badge>}
			</Flex>

			<Box className="panel-divider" />

			{/* 三阶段指示器 */}
			<Flex className="panel-section" align="center" gap="3">
				<Flex direction="column" gap="1" align="center" style={{ minWidth: 80 }}>
					<Box 
						style={{
							width: 12,
							height: 12,
							borderRadius: 2,
							background: phase === "A" ? "#4a9eff" : "rgba(74, 158, 255, 0.3)",
							boxShadow: phase === "A" ? "0 0 6px #4a9eff" : "none",
						}}
					/>
					<Text size="1" color={phase === "A" ? "blue" : "gray"}>A</Text>
					<Text size="1">{phaseARemaining}/{maxSpeed}</Text>
				</Flex>
				
				<Flex direction="column" gap="1" align="center" style={{ minWidth: 80 }}>
					<Box 
						style={{
							width: 12,
							height: 12,
							borderRadius: 2,
							background: phase === "B" ? "#ffb347" : "rgba(255, 179, 71, 0.3)",
							boxShadow: phase === "B" ? "0 0 6px #ffb347" : "none",
						}}
					/>
					<Text size="1" color={phase === "B" ? "amber" : "gray"}>B</Text>
					<Text size="1">{turnRemaining}°/{maxTurnRate}°</Text>
				</Flex>
				
				<Flex direction="column" gap="1" align="center" style={{ minWidth: 80 }}>
					<Box 
						style={{
							width: 12,
							height: 12,
							borderRadius: 2,
							background: phase === "C" ? "#9b59b6" : "rgba(155, 89, 182, 0.3)",
							boxShadow: phase === "C" ? "0 0 6px #9b59b6" : "none",
						}}
					/>
					<Text size="1" color={phase === "C" ? "purple" : "gray"}>C</Text>
					<Text size="1">{phaseCRemaining}/{maxSpeed}</Text>
				</Flex>
			</Flex>

			<Box className="panel-divider" />

			{/* A/C 阶段：平移操作 */}
			{(phase === "A" || phase === "C") && (
				<>
					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">模式</Text>
						<Button 
							size="1" 
							variant={translateMode === "forward" ? "solid" : "soft"} 
							color="blue"
							onClick={() => handleTranslateModeChange("forward")}
							disabled={!canAct || (modeLocked && translateMode !== "forward")}
						>
							前后
						</Button>
						<Button 
							size="1" 
							variant={translateMode === "strafe" ? "solid" : "soft"} 
							color="purple"
							onClick={() => handleTranslateModeChange("strafe")}
							disabled={!canAct || (modeLocked && translateMode !== "strafe")}
						>
							左右
						</Button>
						{modeLocked && <Badge size="1" color="gray">锁定</Badge>}
					</Flex>

					<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 200 }}>
						<Text size="1" className="panel-section__label">
							{translateMode === "forward" ? "前后" : "左右"}
						</Text>
						<input
							type="range"
							min={phase === "A" ? -(phaseARemaining) : phaseCRemaining}
							max={phase === "A" ? phaseARemaining : -(phaseCRemaining)}
							step={5}
							value={translateValue}
							onChange={(e) => handleTranslateValueChange(e.target.value)}
							disabled={!canAct}
							style={{ width: 100 }}
						/>
						<TextField.Root
							size="1"
							value={translateValue.toString()}
							onChange={(e) => handleTranslateValueChange(e.target.value)}
							style={{ width: 50 }}
							disabled={!canAct}
						/>
						<Text size="1" color="gray">
							{translateMode === "forward" 
								? (translateValue > 0 ? "前进" : translateValue < 0 ? "后退" : "")
								: (translateValue > 0 ? "左移" : translateValue < 0 ? "右移" : "")
							}
						</Text>
					</Flex>
				</>
			)}

			{/* B 阶段：旋转操作 */}
			{phase === "B" && (
				<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 200 }}>
					<Text size="1" className="panel-section__label">转向</Text>
					<input
						type="range"
						min={-turnRemaining}
						max={turnRemaining}
						step={5}
						value={rotateValue}
						onChange={(e) => handleRotateValueChange(e.target.value)}
						disabled={!canAct}
						style={{ width: 100 }}
					/>
					<TextField.Root
						size="1"
						value={rotateValue.toString()}
						onChange={(e) => handleRotateValueChange(e.target.value)}
						style={{ width: 50 }}
						disabled={!canAct}
					/>
					<Text size="1" color="gray">
						{rotateValue > 0 ? "右转" : rotateValue < 0 ? "左转" : ""}
					</Text>
				</Flex>
			)}

			{/* 通用执行按钮 */}
			<Button 
				size="1" 
				variant="solid" 
				color={resourceExhausted ? "gray" : "green"}
				onClick={handleExecute}
				disabled={!canExecute}
			>
				<Play size={12} /> {resourceExhausted ? "资源耗尽" : "执行"}
			</Button>

			{/* 通用推进按钮 */}
			{phase !== "DONE" && (
				<Button size="1" variant="soft" color="blue" onClick={handleAdvancePhase} disabled={!canAct}>
					<ChevronRight size={12} /> 推进
				</Button>
			)}
		</Flex>
	);
};

export default MovementPanel;