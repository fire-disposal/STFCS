/**
 * 护盾管理面板 - 横向布局
 * 使用 useGameAction hook，无需 room prop
 */

import React, { useState } from "react";
import { Shield, Zap, Radio, AlertTriangle, RotateCw } from "lucide-react";
import type { CombatToken } from "@vt/data";
import { Button, Flex, Box, Text, Badge, TextField } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import "./battle-panel.css";

export interface ShieldPanelProps {
	ship: CombatToken | null;
	canControl: boolean;
}

export const ShieldPanel: React.FC<ShieldPanelProps> = ({ ship, canControl }) => {
	const { isAvailable, sendShieldToggle, sendShieldRotate, sendVent } = useGameAction();

	const hasShip = ship && ship.runtime;

	// 检查舰船是否有护盾规格
	const hasShieldSpec = hasShip && ship.spec.shield && ship.spec.shield.arc > 0;
	
	const shieldActive = hasShip ? (ship.runtime.shield?.active ?? false) : false;
	const shieldDirection = hasShip ? (ship.runtime.shield?.direction ?? 0) : 0;
	const [directionInput, setDirectionInput] = useState(shieldDirection);

	const fluxSoft = hasShip ? (ship.runtime.fluxSoft ?? 0) : 0;
	const fluxHard = hasShip ? (ship.runtime.fluxHard ?? 0) : 0;
	const fluxTotal = fluxSoft + fluxHard;
	const fluxMax = hasShip ? (ship.spec.fluxCapacity ?? 100) : 100;

	const overloaded = hasShip ? ship.runtime.overloaded : false;
	const venting = hasShip ? ship.runtime.venting : false;
	const destroyed = hasShip ? ship.runtime.destroyed : false;

	const canAct = canControl && hasShip && isAvailable;
	const canToggleShield = canAct && hasShieldSpec && !overloaded && !destroyed;
	const canRotateShield = canToggleShield && shieldActive;

	// 护盾弧度（决定是否需要朝向控制）
	const shieldArc = hasShip ? (ship.spec.shield?.arc ?? 360) : 360;
	const needsDirectionControl = shieldArc < 360;

	const handleToggleShield = async () => {
		if (!canToggleShield) return;
		await sendShieldToggle(ship.$id, !shieldActive);
	};

	const handleRotateShield = async (direction: number) => {
		if (!canRotateShield) return;
		setDirectionInput(direction);
		await sendShieldRotate(ship.$id, direction);
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
				{destroyed && <Badge color="gray" size="1">损毁</Badge>}
			</Flex>

			<Box className="panel-divider" />

			{hasShieldSpec ? (
				<>
					<Flex className="panel-section" align="center" gap="2">
						<Shield size={14} />
						<Text size="1" className="panel-section__label">护盾</Text>
						<Badge size="1" color={shieldActive ? "blue" : "gray"}>{shieldActive ? "ON" : "OFF"}</Badge>
						{shieldArc < 360 && <Text size="1" color="gray">{shieldArc}°</Text>}
					</Flex>

					{needsDirectionControl && (
						<>
							<Box className="panel-divider" />

							<Flex className="panel-section" align="center" gap="2">
								<RotateCw size={14} />
								<Text size="1" className="panel-section__label">朝向</Text>
								<input
									type="range"
									min={0}
									max={360}
									step={5}
									value={directionInput}
									onChange={(e) => handleRotateShield(Number(e.target.value))}
									disabled={!canRotateShield}
									style={{ width: 80 }}
								/>
								<TextField.Root
									size="1"
									value={directionInput.toString()}
									onChange={(e) => {
										const v = Number(e.target.value) || 0;
										handleRotateShield(Math.max(0, Math.min(360, v)));
									}}
									style={{ width: 50 }}
									disabled={!canRotateShield}
								/>
								<Text size="1" color="gray">°</Text>
							</Flex>
						</>
					)}

					<Box className="panel-divider" />

					<Button size="1" variant="solid" color="blue" onClick={handleToggleShield} disabled={!canToggleShield}>
						<Shield size={12} /> {shieldActive ? "关闭" : "开启"}
					</Button>
				</>
			) : (
				<Flex className="panel-section" align="center" gap="2">
					<Shield size={14} />
					<Text size="1" className="panel-section__label">护盾</Text>
					<Badge size="1" color="gray">无护盾</Badge>
				</Flex>
			)}

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Radio size={14} />
				<Text size="1" className="panel-section__label">软辐能</Text>
				<Text size="1" className="panel-section__value">{hasShip ? `${fluxSoft}/${fluxMax}` : "NA"}</Text>
			</Flex>

			<Flex className="panel-section" align="center" gap="2">
				<Zap size={14} />
				<Text size="1" className="panel-section__label">硬辐能</Text>
				<Text size="1" className="panel-section__value">{hasShip ? `${fluxHard}` : "NA"}</Text>
			</Flex>

			<Box className="panel-divider" />

			<Button size="1" variant="soft" color="purple" onClick={handleVent} disabled={!canAct || fluxTotal === 0 || venting}>
				<Zap size={12} /> 散辐
			</Button>
		</Flex>
	);
};

export default ShieldPanel;