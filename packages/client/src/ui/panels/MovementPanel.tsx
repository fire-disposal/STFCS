import React, { useState, useEffect, useMemo, useCallback } from "react";
import { RotateCcw, RotateCw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import type { CombatToken, MovementPhase } from "@vt/data";
import { Button, Flex, Box, Text, TextField, Slider, Badge } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useUIStore } from "@/state/stores/uiStore";
import "./battle-panel.css";

export interface MovementPanelProps {
	ship: CombatToken | null;
	canControl: boolean;
}

const PHASE_LABELS: Record<MovementPhase, string> = {
	A: "Phase A - 前进/后退",
	B: "Phase B - 转向",
	C: "Phase C - 横移",
	DONE: "移动完成",
};

export const MovementPanel: React.FC<MovementPanelProps> = ({ ship, canControl }) => {
	const [forward, setForward] = useState(0);
	const [strafe, setStrafe] = useState(0);
	const [angle, setAngle] = useState(0);

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

	const canAct = canControl && hasShip && isAvailable && phase !== "DONE";

	const updatePreview = useCallback((mode: "forward" | "strafe" | "turn", value: number) => {
		if (!hasShip) {
			setMovementPreview(null);
			return;
		}
		setMovementPreview({
			shipId: ship.$id,
			phase,
			mode: mode === "turn" ? "forward" : mode,
			value,
			turn: mode === "turn" ? value : 0,
			remaining: {
				forward: phaseARemaining,
				strafe: phaseCRemaining,
				turn: turnRemaining,
			},
			directionLocked: Boolean(movement?.phaseALock ?? movement?.phaseCLock),
		});
	}, [hasShip, ship, phase, phaseARemaining, phaseCRemaining, turnRemaining, movement, setMovementPreview]);

	const clearPreview = useCallback(() => {
		setMovementPreview(null);
	}, [setMovementPreview]);

	useEffect(() => {
		return () => clearPreview();
	}, [clearPreview]);

	const handleMove = async (forwardDist: number, strafeDist: number) => {
		if (!canAct) return;
		clearPreview();
		await sendMove(ship.$id, forwardDist, strafeDist);
	};

	const handleRotate = async (angleDeg: number) => {
		if (!canAct) return;
		clearPreview();
		await sendRotate(ship.$id, angleDeg);
	};

	const handleAdvancePhase = async () => {
		if (!canAct) return;
		clearPreview();
		await sendAdvancePhase(ship.$id);
	};

	const handleForwardChange = (value: number | string) => {
		const num = typeof value === "string" ? Number(value) || 0 : value;
		setForward(num);
		updatePreview("forward", num);
	};

	const handleStrafeChange = (value: number | string) => {
		const num = typeof value === "string" ? Number(value) || 0 : value;
		setStrafe(num);
		updatePreview("strafe", num);
	};

	const handleAngleChange = (value: number | string) => {
		const num = typeof value === "string" ? Number(value) || 0 : value;
		setAngle(num);
		updatePreview("turn", num);
	};

	const phaseColor = useMemo(() => {
		switch (phase) {
			case "A": return "blue";
			case "B": return "amber";
			case "C": return "purple";
			case "DONE": return "gray";
			default: return "gray";
		}
	}, [phase]);

	return (
		<Flex className="panel-row" gap="3" wrap="wrap">
			<Flex className="panel-section" align="center" gap="2">
				<Text size="2" weight="bold">{hasShip ? (ship.metadata?.name ?? ship.$id.slice(-6)) : "请选择舰船"}</Text>
				<Badge size="1" color={phaseColor}>{PHASE_LABELS[phase] ?? phase}</Badge>
				{hasMoved && <Text size="1" color="amber">已移动</Text>}
			</Flex>

			<Box className="panel-divider" />

			{phase === "A" && (
				<>
					<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 180 }}>
						<Text size="1" className="panel-section__label">前进</Text>
						<Slider
							size="1"
							value={[forward]}
							onValueChange={(v) => handleForwardChange(v[0] ?? 0)}
							min={0}
							max={phaseARemaining}
							step={5}
							style={{ width: 80 }}
							disabled={!canAct}
						/>
						<TextField.Root
							size="1"
							value={forward.toString()}
							onChange={(e) => handleForwardChange(e.target.value)}
							style={{ width: 50 }}
							disabled={!canAct}
						/>
						<Button size="1" variant="soft" onClick={() => handleMove(forward, 0)} disabled={!canAct || forward === 0}>
							<ArrowUp size={12} />
						</Button>
					</Flex>

					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">后退</Text>
						<Button size="1" variant="soft" onClick={() => handleMove(-forward, 0)} disabled={!canAct || forward === 0}>
							<ArrowDown size={12} />
						</Button>
					</Flex>

					<Flex align="center" gap="1">
						<Text size="1" color="gray">剩余:</Text>
						<Text size="1" color="blue">{phaseARemaining}</Text>
						<Text size="1" color="gray">/ {maxSpeed}</Text>
					</Flex>
				</>
			)}

			{phase === "B" && (
				<>
					<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 180 }}>
						<Text size="1" className="panel-section__label">角度</Text>
						<Slider
							size="1"
							value={[angle]}
							onValueChange={(v) => handleAngleChange(v[0] ?? 0)}
							min={0}
							max={turnRemaining}
							step={5}
							style={{ width: 80 }}
							disabled={!canAct}
						/>
						<TextField.Root
							size="1"
							value={angle.toString()}
							onChange={(e) => handleAngleChange(e.target.value)}
							style={{ width: 50 }}
							disabled={!canAct}
						/>
						<Button size="1" variant="soft" onClick={() => handleRotate(-angle)} disabled={!canAct || angle === 0}>
							<RotateCcw size={12} />
						</Button>
						<Button size="1" variant="soft" onClick={() => handleRotate(angle)} disabled={!canAct || angle === 0}>
							<RotateCw size={12} />
						</Button>
					</Flex>

					<Flex align="center" gap="1">
						<Text size="1" color="gray">剩余:</Text>
						<Text size="1" color="amber">{turnRemaining}°</Text>
						<Text size="1" color="gray">/ {maxTurnRate}°</Text>
					</Flex>
				</>
			)}

			{phase === "C" && (
				<>
					<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 180 }}>
						<Text size="1" className="panel-section__label">左移</Text>
						<Slider
							size="1"
							value={[strafe]}
							onValueChange={(v) => handleStrafeChange(v[0] ?? 0)}
							min={0}
							max={phaseCRemaining}
							step={5}
							style={{ width: 80 }}
							disabled={!canAct}
						/>
						<TextField.Root
							size="1"
							value={strafe.toString()}
							onChange={(e) => handleStrafeChange(e.target.value)}
							style={{ width: 50 }}
							disabled={!canAct}
						/>
						<Button size="1" variant="soft" onClick={() => handleMove(0, -strafe)} disabled={!canAct || strafe === 0}>
							<ArrowLeft size={12} />
						</Button>
					</Flex>

					<Flex className="panel-section" align="center" gap="2">
						<Text size="1" className="panel-section__label">右移</Text>
						<Button size="1" variant="soft" onClick={() => handleMove(0, strafe)} disabled={!canAct || strafe === 0}>
							<ArrowRight size={12} />
						</Button>
					</Flex>

					<Flex align="center" gap="1">
						<Text size="1" color="gray">剩余:</Text>
						<Text size="1" color="purple">{phaseCRemaining}</Text>
						<Text size="1" color="gray">/ {maxSpeed}</Text>
					</Flex>
				</>
			)}

			{phase !== "DONE" && (
				<>
					<Box className="panel-divider" />

					<Button size="1" variant="soft" color="blue" onClick={handleAdvancePhase} disabled={!canAct}>
						<ChevronRight size={12} /> 推进阶段
					</Button>
				</>
			)}

			<Box className="panel-divider" />

			<Flex align="center" gap="2">
				<Text size="1" color="gray">Phase A:</Text>
				<Text size="1">{phaseAUsed}</Text>
				<Text size="1" color="gray">| Phase C:</Text>
				<Text size="1">{phaseCUsed}</Text>
				<Text size="1" color="gray">| 转向:</Text>
				<Text size="1">{turnAngleUsed}°</Text>
			</Flex>
		</Flex>
	);
};

export default MovementPanel;