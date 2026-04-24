/**
 * 护盾管理面板 - 横向布局
 * 
 * 功能：
 * 1. 护盾开关（独立按钮）
 * 2. 护盾朝向调整（预览 + 确认）
 * 3. 辐能显示
 * 4. 散辐功能
 */

import React, { useState, useEffect } from "react";
import { Shield, Zap, Radio, AlertTriangle, RotateCw, Check } from "lucide-react";
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
	const hasShieldSpec = Boolean(hasShip && ship.spec?.shield);

	const shieldActive = hasShip ? (ship.runtime.shield?.active ?? false) : false;
	const shieldDirection = hasShip ? (ship.runtime.shield?.direction ?? 0) : 0;

	const [previewDirection, setPreviewDirection] = useState(shieldDirection);
	const [pendingDirection, setPendingDirection] = useState<number | null>(null);

	useEffect(() => {
		setPreviewDirection(shieldDirection);
		setPendingDirection(null);
	}, [shieldDirection]);

	const fluxSoft = hasShip ? (ship.runtime.fluxSoft ?? 0) : 0;
	const fluxHard = hasShip ? (ship.runtime.fluxHard ?? 0) : 0;
	const fluxTotal = fluxSoft + fluxHard;
	const fluxMax = hasShip ? (ship.spec.fluxCapacity ?? 100) : 100;

	const overloaded = hasShip ? ship.runtime.overloaded : false;
	const venting = hasShip ? ship.runtime.venting : false;
	const destroyed = hasShip ? ship.runtime.destroyed : false;

	const canAct = canControl && hasShip && isAvailable;
	const canToggleShield = canAct && hasShieldSpec && !overloaded && !destroyed;
	const canRotateShield = canAct && hasShieldSpec && shieldActive && !overloaded;

	const shieldArc = hasShip ? (ship.spec.shield?.arc ?? 360) : 360;
	const needsDirectionControl = shieldArc < 360;
	const hasDirectionChange = pendingDirection !== null && pendingDirection !== shieldDirection;

	const handleToggleShield = async () => {
		if (!canToggleShield) return;
		await sendShieldToggle(ship.$id, !shieldActive);
	};

	const handleDirectionPreview = (direction: number) => {
		setPreviewDirection(direction);
		setPendingDirection(direction);
	};

	const handleConfirmDirection = async () => {
		if (!canRotateShield || pendingDirection === null) return;
		await sendShieldRotate(ship.$id, pendingDirection);
		setPendingDirection(null);
	};

	const handleCancelDirection = () => {
		setPreviewDirection(shieldDirection);
		setPendingDirection(null);
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
						{shieldArc < 360 && <Text size="1" color="gray">{shieldArc}°弧</Text>}
					</Flex>

					<Box className="panel-divider" />

					<Button size="1" variant="solid" color={shieldActive ? "gray" : "blue"} onClick={handleToggleShield} disabled={!canToggleShield} data-magnetic>
						<Shield size={12} /> {shieldActive ? "关闭" : "开启"}
					</Button>

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
									step={15}
									value={previewDirection}
									onChange={(e) => handleDirectionPreview(Number(e.target.value))}
									disabled={!canRotateShield}
									style={{ width: 80 }}
								/>
								<TextField.Root
									size="1"
									value={previewDirection.toString()}
									onChange={(e) => {
										const v = Number(e.target.value) || 0;
										handleDirectionPreview(Math.max(0, Math.min(360, v)));
									}}
									style={{ width: 50 }}
									disabled={!canRotateShield}
								/>
								<Text size="1" color="gray">°</Text>
								{!shieldActive && <Badge size="1" color="amber">需开启</Badge>}
							</Flex>

							{hasDirectionChange && (
								<>
									<Button size="1" variant="solid" color="green" onClick={handleConfirmDirection} data-magnetic>
										<Check size={12} /> 确认
									</Button>
									<Button size="1" variant="soft" color="gray" onClick={handleCancelDirection} data-magnetic>
										取消
									</Button>
								</>
							)}
						</>
					)}
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
				<Text size="1" className="panel-section__label">软辐</Text>
				<Text size="1" className="panel-section__value">{hasShip ? `${fluxSoft}/${fluxMax}` : "NA"}</Text>
			</Flex>

			<Flex className="panel-section" align="center" gap="2">
				<Zap size={14} />
				<Text size="1" className="panel-section__label">硬辐</Text>
				<Text size="1" className="panel-section__value">{hasShip ? `${fluxHard}` : "NA"}</Text>
			</Flex>

			<Box className="panel-divider" />

			<Button size="1" variant="soft" color="purple" onClick={handleVent} disabled={!canAct || fluxTotal === 0 || venting} data-magnetic>
				<Zap size={12} /> 散辐
			</Button>
		</Flex>
	);
};

export default ShieldPanel;