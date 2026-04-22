/**
 * 移动控制面板 - 横向布局
 * 使用 useGameAction hook，无需 room prop
 */

import React, { useState } from "react";
import { RotateCcw, RotateCw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import type { ShipViewModel } from "@/renderer";
import { Button, Flex, Box, Text, TextField } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import "./battle-panel.css";

export interface MovementPanelProps {
	ship: ShipViewModel | null;
	canControl: boolean;
}

export const MovementPanel: React.FC<MovementPanelProps> = ({ ship, canControl }) => {
	const [forward, setForward] = useState(0);
	const [strafe, setStrafe] = useState(0);
	const [angle, setAngle] = useState(0);

	const { isAvailable, sendMove, sendRotate, sendAdvancePhase } = useGameAction();

	const hasShip = ship && ship.runtime;
	const phase = hasShip ? (ship.runtime.movement?.currentPhase ?? "A") : "-";
	const hasMoved = hasShip ? (ship.runtime.movement?.hasMoved ?? false) : false;

	const canAct = canControl && hasShip && isAvailable;

	const handleMove = async (forwardDist: number, strafeDist: number) => {
		if (!canAct) return;
		await sendMove(ship.id, forwardDist, strafeDist);
	};

	const handleRotate = async (angleDeg: number) => {
		if (!canAct) return;
		await sendRotate(ship.id, angleDeg);
	};

	const handleAdvancePhase = async () => {
		if (!canAct) return;
		await sendAdvancePhase(ship.id);
	};

	return (
		<Flex className="panel-row" gap="3">
			<Flex className="panel-section" align="center" gap="2">
				<Text size="2" weight="bold">{hasShip ? (ship.metadata?.name ?? ship.id.slice(-6)) : "请选择舰船"}</Text>
				<Text size="1" color="gray">Phase: {phase}</Text>
				{hasMoved && <Text size="1" color="amber">已移动</Text>}
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Text size="1" className="panel-section__label">前进</Text>
				<TextField.Root size="1" value={forward.toString()} onChange={(e) => setForward(Number(e.target.value) || 0)} style={{ width: 50 }} />
				<Button size="1" variant="soft" onClick={() => handleMove(forward, 0)} disabled={!canAct}>
					<ArrowUp size={12} />
				</Button>
			</Flex>

			<Flex className="panel-section" align="center" gap="2">
				<Text size="1" className="panel-section__label">后退</Text>
				<Button size="1" variant="soft" onClick={() => handleMove(-forward, 0)} disabled={!canAct}>
					<ArrowDown size={12} />
				</Button>
			</Flex>

			<Flex className="panel-section" align="center" gap="2">
				<Text size="1" className="panel-section__label">左移</Text>
				<TextField.Root size="1" value={strafe.toString()} onChange={(e) => setStrafe(Number(e.target.value) || 0)} style={{ width: 50 }} />
				<Button size="1" variant="soft" onClick={() => handleMove(0, -strafe)} disabled={!canAct}>
					<ArrowLeft size={12} />
				</Button>
			</Flex>

			<Flex className="panel-section" align="center" gap="2">
				<Text size="1" className="panel-section__label">右移</Text>
				<Button size="1" variant="soft" onClick={() => handleMove(0, strafe)} disabled={!canAct}>
					<ArrowRight size={12} />
				</Button>
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Text size="1" className="panel-section__label">角度</Text>
				<TextField.Root size="1" value={angle.toString()} onChange={(e) => setAngle(Number(e.target.value) || 0)} style={{ width: 50 }} />
				<Button size="1" variant="soft" onClick={() => handleRotate(-angle)} disabled={!canAct}>
					<RotateCcw size={12} />
				</Button>
				<Button size="1" variant="soft" onClick={() => handleRotate(angle)} disabled={!canAct}>
					<RotateCw size={12} />
				</Button>
			</Flex>

			<Box className="panel-divider" />

			<Button size="1" variant="soft" color="blue" onClick={handleAdvancePhase} disabled={!canAct}>
				<ChevronRight size={12} /> 推进阶段
			</Button>
		</Flex>
	);
};

export default MovementPanel;