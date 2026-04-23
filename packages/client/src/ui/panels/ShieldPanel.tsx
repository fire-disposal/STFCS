/**
 * 护盾管理面板 - 横向布局
 * 使用 useGameAction hook，无需 room prop
 */

import React from "react";
import { Shield, Zap, Radio, AlertTriangle } from "lucide-react";
import type { CombatToken } from "@vt/data";
import { Button, Flex, Box, Text, Badge, Progress } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import "./battle-panel.css";

export interface ShieldPanelProps {
	ship: CombatToken | null;
	canControl: boolean;
}

export const ShieldPanel: React.FC<ShieldPanelProps> = ({ ship, canControl }) => {
	const { isAvailable, sendShieldToggle, sendVent } = useGameAction();

	const hasShip = ship && ship.runtime;

	const shieldActive = hasShip ? (ship.runtime.shield?.active ?? false) : false;
	const shieldVal = hasShip ? (ship.runtime.shield?.value ?? 0) : 0;
	const shieldMax = hasShip ? (ship.spec.shield?.upkeep ?? 100) : 100;
	const shieldPct = hasShip ? Math.min(100, (shieldVal / shieldMax) * 100) : 0;

	const fluxSoft = hasShip ? (ship.runtime.fluxSoft ?? 0) : 0;
	const fluxHard = hasShip ? (ship.runtime.fluxHard ?? 0) : 0;
	const fluxTotal = fluxSoft + fluxHard;
	const fluxMax = hasShip ? (ship.spec.fluxCapacity ?? 100) : 100;
	const fluxPct = hasShip ? Math.min(100, (fluxTotal / fluxMax) * 100) : 0;

	const overloaded = hasShip ? ship.runtime.overloaded : false;
	const venting = hasShip ? ship.runtime.venting : false;

	const canAct = canControl && hasShip && isAvailable;

	const handleToggleShield = async () => {
		if (!canAct) return;
		await sendShieldToggle(ship.$id, !shieldActive);
	};

	const handleVent = async () => {
		if (!canAct || fluxTotal === 0) return;
		await sendVent(ship.$id);
	};

	return (
		<Flex className="panel-row" gap="3">
			<Flex className="panel-section" align="center" gap="2">
				<Text size="2" weight="bold">{hasShip ? (ship.metadata?.name ?? ship.$id.slice(-6)) : "请选择舰船"}</Text>
				{overloaded && <Badge color="red" size="1"><AlertTriangle size={10} /> 过载</Badge>}
				{venting && <Badge color="purple" size="1">散辐中</Badge>}
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Shield size={14} />
				<Text size="1" className="panel-section__label">护盾</Text>
				<Progress value={shieldPct} color="blue" style={{ width: 80 }} />
				<Text size="1" className="panel-section__value">{hasShip ? `${shieldVal}/${shieldMax}` : "NA"}</Text>
				<Badge size="1" color={shieldActive ? "blue" : "gray"}>{shieldActive ? "ON" : "OFF"}</Badge>
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Radio size={14} />
				<Text size="1" className="panel-section__label">软辐能</Text>
				<Progress value={fluxPct} color="purple" style={{ width: 80 }} />
				<Text size="1" className="panel-section__value">{hasShip ? `${fluxSoft}/${fluxMax}` : "NA"}</Text>
			</Flex>

			<Flex className="panel-section" align="center" gap="2">
				<Zap size={14} />
				<Text size="1" className="panel-section__label">硬辐能</Text>
				<Text size="1" className="panel-section__value">{hasShip ? `${fluxHard}` : "NA"}</Text>
			</Flex>

			<Box className="panel-divider" />

			<Button size="1" variant="solid" color="blue" onClick={handleToggleShield} disabled={!canAct}>
				<Shield size={12} /> {shieldActive ? "关闭" : "开启"}
			</Button>

			<Button size="1" variant="soft" color="purple" onClick={handleVent} disabled={!canAct || fluxTotal === 0 || venting}>
				<Zap size={12} /> 散辐
			</Button>
		</Flex>
	);
};

export default ShieldPanel;