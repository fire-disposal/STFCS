/**
 * 护盾管理面板 - 横向布局
 *
 * 功能：
 * 1. 护盾开关（独立按钮）
 * 2. 护盾朝向调整（预览 + 确认）
 * 3. 辐能条可视化（软辐 + 硬辐 + 过载区）
 * 4. 散辐功能
 */

import React, { useState, useEffect } from "react";
import { Shield, Zap, AlertTriangle, RotateCw, Check, X } from "lucide-react";
import type { CombatToken } from "@vt/data";
import { Button, Flex, Box, Text, Badge, TextField } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useUIStore } from "@/state/stores/uiStore";
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

	const fluxSoftPct = fluxMax > 0 ? Math.min(100, (fluxSoft / fluxMax) * 100) : 0;
	const fluxHardPct = fluxMax > 0 ? Math.min(100, (fluxHard / fluxMax) * 100) : 0;
	const fluxTotalPct = Math.min(100, fluxSoftPct + fluxHardPct);

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
		if (ship) {
			useUIStore.getState().setShieldDirectionPreview(ship.$id, direction);
		}
	};

	const handleConfirmDirection = async () => {
		if (!canRotateShield || pendingDirection === null) return;
		await sendShieldRotate(ship.$id, pendingDirection);
		setPendingDirection(null);
		if (ship) {
			useUIStore.getState().setShieldDirectionPreview(ship.$id, undefined);
		}
	};

	const handleCancelDirection = () => {
		setPreviewDirection(shieldDirection);
		setPendingDirection(null);
		if (ship) {
			useUIStore.getState().setShieldDirectionPreview(ship.$id, undefined);
		}
	};

	const handleVent = async () => {
		if (!canAct || fluxTotal === 0) return;
		await sendVent(ship.$id);
	};

	return (
		<Flex className="panel-row" gap="3">
			{/* 舰船标识 */}
			<Flex className="panel-section panel-section--vertical" gap="1" style={{ minWidth: 100 }}>
				<Text size="5" weight="bold" style={{ color: "#cfe8ff", lineHeight: 1.2 }}>
					{hasShip ? (ship.metadata?.name ?? ship.$id.slice(-6)) : "请选择舰船"}
				</Text>
				<Flex align="center" gap="2" wrap="wrap">
					{overloaded && <Badge size="2" color="red"><AlertTriangle size={12} /> 过载</Badge>}
					{venting && <Badge size="2" color="purple">散辐中</Badge>}
					{destroyed && <Badge size="2" color="gray">损毁</Badge>}
				</Flex>
			</Flex>

			<Box className="panel-divider" />

			{/* 护盾控制区 */}
			{hasShieldSpec ? (
				<Flex className="panel-section" align="center" gap="3">
					{/* 护盾开关 */}
					<Flex direction="column" align="center" gap="1">
						<Button size="2" variant="solid" color={shieldActive ? "gray" : "blue"} onClick={handleToggleShield} disabled={!canToggleShield} data-magnetic style={{ width: 64, height: 48 }}>
							<Shield size={18} />
						</Button>
						<Badge size="1" color={shieldActive ? "blue" : "gray"}>{shieldActive ? "ON" : "OFF"}</Badge>
					</Flex>

					{/* 朝向控制 */}
					{needsDirectionControl ? (
						<Flex direction="column" gap="2">
							<Flex align="center" gap="2">
								<RotateCw size={16} style={{ color: "#6b8aaa" }} />
								<Text size="2" style={{ color: "#6b8aaa", fontWeight: 600 }}>朝向</Text>
								<Text size="4" weight="bold" style={{ color: "#cfe8ff", fontFamily: "'Fira Code', monospace", minWidth: 36 }}>
									{previewDirection}°
								</Text>
							</Flex>
							<Flex align="center" gap="2">
								<input
									type="range"
									min={0}
									max={360}
									step={15}
									value={previewDirection}
									onChange={(e) => handleDirectionPreview(Number(e.target.value))}
									disabled={!canRotateShield}
									style={{ width: 120 }}
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
								{!shieldActive && <Badge size="1" color="amber">需开启</Badge>}
							</Flex>
							{/* 确认/取消按钮 */}
							{hasDirectionChange && (
								<Flex gap="1">
									<Button size="1" variant="solid" color="green" onClick={handleConfirmDirection} data-magnetic>
										<Check size={12} /> 确认
									</Button>
									<Button size="1" variant="soft" color="gray" onClick={handleCancelDirection} data-magnetic>
										<X size={12} /> 取消
									</Button>
								</Flex>
							)}
						</Flex>
					) : (
						<Flex align="center" gap="2">
							<Text size="2" style={{ color: "#6b8aaa" }}>全向护盾</Text>
							<Text size="1" style={{ color: "#4a5568" }}>(360°)</Text>
						</Flex>
					)}
				</Flex>
			) : (
				<Flex className="panel-section" align="center" gap="2">
					<Shield size={20} style={{ color: "#4a5568" }} />
					<Text size="3" style={{ color: "#4a5568" }}>无护盾</Text>
				</Flex>
			)}

			<Box className="panel-divider" />

			{/* 辐能可视化 - 大号 */}
			<Flex className="panel-section panel-section--vertical" gap="2" style={{ minWidth: 240, flex: 1 }}>
				<Flex align="center" justify="between" style={{ width: "100%" }}>
					<Flex align="center" gap="2">
						<Zap size={18} style={{ color: overloaded ? "#ff4444" : "#ffaa00" }} />
						<Text size="2" style={{ color: "#6b8aaa", fontWeight: 600 }}>辐能</Text>
					</Flex>
					<Flex gap="3" align="center">
						<Flex gap="1" align="center">
							<Box style={{ width: 10, height: 10, borderRadius: 2, background: "#6ab4ff" }} />
							<Text size="2" style={{ color: "#8ba4c7" }}>软 {fluxSoft}</Text>
						</Flex>
						<Flex gap="1" align="center">
							<Box style={{ width: 10, height: 10, borderRadius: 2, background: "#ff6f8f" }} />
							<Text size="2" style={{ color: "#8ba4c7" }}>硬 {fluxHard}</Text>
						</Flex>
					</Flex>
				</Flex>
				<Box className="flux-bar-container" style={{ width: "100%", minWidth: 0 }}>
					<Box className="flux-bar" style={{ height: 20 }}>
						{/* 硬辐能（左）— 粉色 */}
						<Box
							className="flux-bar__fill--hard"
							style={{ width: `${fluxHardPct}%` }}
						/>
						{/* 软辐能（右）— 蓝色 */}
						<Box
							className="flux-bar__fill--soft"
							style={{ width: `${fluxSoftPct}%`, left: `${fluxHardPct}%` }}
						/>
						{/* 过载时全条红色闪烁覆盖 */}
						{overloaded && (
							<Box
								className="flux-bar__fill--overload"
								style={{ width: `${fluxTotalPct}%` }}
							/>
						)}
					</Box>
					<Flex justify="between" style={{ width: "100%" }}>
						<Text size="2" weight="bold" style={{ color: fluxTotalPct > 90 ? "#ff4444" : "#cfe8ff", fontFamily: "'Fira Code', monospace" }}>
							{fluxTotal} / {fluxMax}
						</Text>
						<Text size="1" style={{ color: overloaded ? "#ff4444" : "#6b8aaa" }}>
							{overloaded ? "过载" : `${fluxTotalPct.toFixed(0)}%`}
						</Text>
					</Flex>
				</Box>
			</Flex>

			<Box className="panel-divider" />

			{/* 散辐按钮 */}
			<Flex direction="column" align="center" gap="1">
				<Button
					size="2"
					variant="soft"
					color="purple"
					onClick={handleVent}
					disabled={!canAct || fluxTotal === 0 || venting}
					data-magnetic
					style={{ width: 64, height: 48 }}
				>
					<Zap size={18} />
				</Button>
				<Badge size="1" color={venting ? "purple" : "gray"}>散辐</Badge>
			</Flex>
		</Flex>
	);
};

export default ShieldPanel;
