/**
 * ShieldPanel - 护盾管理面板（优化版）
 *
 * 设计优化：
 * - 移除舰船标识区（顶栏已显示）
 * - 紧凑的护盾开关 + 方向控制
 * - 移除重复的辐能条（ShipInfoPanel已显示）
 * - 优化散辐按钮设计
 */

import React, { useState, useEffect } from "react";
import { Shield, Zap, AlertTriangle, RotateCw, Check, X } from "lucide-react";
import { Button, Flex, Box, Text, Badge } from "@radix-ui/themes";
import { useGameAction } from "@/hooks/useGameAction";
import { useUIStore } from "@/state/stores/uiStore";
import { useSelectedShip } from "@/hooks/useSelectedShip";
import SliderInput from "@/ui/shared/SliderInput";
import "./battle-panel.css";

export interface ShieldPanelProps {
	canControl?: boolean;
}

export const ShieldPanel: React.FC<ShieldPanelProps> = ({ canControl = true }) => {
	const { isAvailable, sendShieldToggle, sendShieldRotate, sendVent } = useGameAction();

	const ship = useSelectedShip();
	const hasShip = ship && ship.runtime;
	const hasShieldSpec = Boolean(hasShip && ship.spec?.shield);

	const shieldActive = hasShip ? (ship.runtime.shield?.active ?? false) : false;
	const shieldDirection = hasShip ? (ship.runtime.shield?.direction ?? 0) : 0;
	const shieldArc = hasShip ? (ship.spec.shield?.arc ?? 360) : 360;
	const needsDirectionControl = shieldArc < 360;

	const overloaded = hasShip ? ship.runtime.overloaded : false;
	const venting = hasShip ? ship.runtime.venting : false;
	const destroyed = hasShip ? ship.runtime.destroyed : false;

	const fluxSoft = hasShip ? (ship.runtime.fluxSoft ?? 0) : 0;
	const fluxHard = hasShip ? (ship.runtime.fluxHard ?? 0) : 0;
	const fluxTotal = fluxSoft + fluxHard;
	const fluxMax = hasShip ? (ship.spec.fluxCapacity ?? 100) : 100;
	const fluxPct = fluxMax > 0 ? Math.min(100, (fluxTotal / fluxMax) * 100) : 0;

	const [previewDirection, setPreviewDirection] = useState(shieldDirection);
	const [pendingDirection, setPendingDirection] = useState<number | null>(null);

	useEffect(() => {
		setPreviewDirection(shieldDirection);
		setPendingDirection(null);
	}, [shieldDirection]);

	const canAct = canControl && hasShip && isAvailable;
	const canToggleShield = canAct && hasShieldSpec && !overloaded && !destroyed;
	const canRotateShield = canAct && hasShieldSpec && shieldActive && !overloaded;
	const canVent = canAct && fluxTotal > 0 && !venting;

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
		if (!canVent) return;
		await sendVent(ship.$id);
	};

	// 状态指示
	const statusBadge = overloaded
		? <Badge size="1" color="red"><AlertTriangle size={10} /> 过载</Badge>
		: venting
			? <Badge size="1" color="purple">散辐中</Badge>
			: destroyed
				? <Badge size="1" color="gray">损毁</Badge>
				: null;

	// 空状态
	if (!hasShip) {
		return (
			<Flex className="panel-row" align="center" gap="3">
				<Text size="2" color="gray">选择舰船后可管理护盾</Text>
			</Flex>
		);
	}

	// 无护盾
	if (!hasShieldSpec) {
		return (
			<Flex className="panel-row" align="center" gap="3">
				<Flex className="panel-section" align="center" gap="2">
					<Shield size={16} style={{ color: "#4a5568" }} />
					<Text size="2" style={{ color: "#4a5568" }}>无护盾装备</Text>
				</Flex>
				{statusBadge}
			</Flex>
		);
	}

	return (
		<Flex className="panel-row" gap="3" align="center">
			{/* 状态徽章 */}
			<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 60 }}>
				{statusBadge}
			</Flex>

			<Box className="panel-divider" />

			{/* 护盾开关 */}
			<Flex className="panel-section" align="center" gap="2">
				<Button size="2" variant={shieldActive ? "solid" : "soft"} color={shieldActive ? "blue" : "gray"}
					onClick={handleToggleShield} disabled={!canToggleShield}>
					<Shield size={14} /> {shieldActive ? "ON" : "OFF"}
				</Button>
				<Text size="1" style={{ color: shieldActive ? "#4a9eff" : "#6b8aaa" }}>
					{shieldArc}°
				</Text>
			</Flex>

			<Box className="panel-divider" />

			{/* 护盾朝向（非全向盾） */}
			{needsDirectionControl ? (
				<>
					<Flex className="panel-section" align="center" gap="2">
						<RotateCw size={14} style={{ color: "#6b8aaa" }} />
						<SliderInput
							value={previewDirection}
							min={0}
							max={360}
							step={15}
							onChange={handleDirectionPreview}
							disabled={!canRotateShield}
							unit="°"
							width={140}
							showInput={false}
						/>
						{pendingDirection !== null && pendingDirection !== shieldDirection && (
							<Flex gap="1">
								<Button size="1" variant="solid" color="green" onClick={handleConfirmDirection}>
									<Check size={12} />
								</Button>
								<Button size="1" variant="soft" color="gray" onClick={handleCancelDirection}>
									<X size={12} />
								</Button>
							</Flex>
						)}
						{!shieldActive && (
							<Badge size="1" color="amber">需开启</Badge>
						)}
					</Flex>
					<Box className="panel-divider" />
				</>
			) : null}

			{/* 辐能状态（简化） */}
			<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 100 }}>
				<Zap size={14} style={{ color: overloaded ? "#ff4444" : fluxPct > 80 ? "#ffaa00" : "#6ab4ff" }} />
				<Text size="2" weight="bold" style={{ color: fluxPct > 90 ? "#ff4444" : "#cfe8ff" }}>
					{fluxTotal}/{fluxMax}
				</Text>
				<Text size="1" style={{ color: "#6b8aaa" }}>
					{fluxPct.toFixed(0)}%
				</Text>
			</Flex>

			<Box className="panel-divider" />

			{/* 散辐按钮 */}
			<Button size="2" variant="soft" color="purple" onClick={handleVent}
				disabled={!canVent}>
				<Zap size={14} /> 散辐
			</Button>
		</Flex>
	);
};

export default ShieldPanel;