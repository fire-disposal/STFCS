/**
 * 舰船信息面板 - 横向列布局
 * 
 * 向 WeaponPanel 风格靠拢：
 * - 使用 CSS 类替代 inline style
 * - 多列布局，每列有 header + content
 */

import React, { useState, useCallback } from "react";
import { Anchor, Zap, AlertTriangle, Edit2, Check, X, Copy } from "lucide-react";
import { FactionColors } from "@vt/data";
import { Badge, Box, Flex, Progress, Text, TextField, IconButton } from "@radix-ui/themes";
import { notify } from "@/ui/shared/Notification";
import { useSelectedShip } from "@/hooks/useSelectedShip";
import { useGameAction } from "@/hooks/useGameAction";
import "./battle-panel-row.css";

const QUADRANT_NAMES = ["前", "右前", "右后", "后", "左后", "左前"];

function getArmorColor(percent: number): string {
	if (percent >= 0.8) return "#2ecc71";
	if (percent >= 0.5) return "#f1c40f";
	if (percent >= 0.25) return "#e74c3c";
	return "#8b0000";
}

export const ShipInfoPanel: React.FC = () => {
	const ship = useSelectedShip();
	const { send } = useGameAction();

	const [isEditingName, setIsEditingName] = useState(false);
	const [editingName, setEditingName] = useState("");

	const hasShip = ship && ship.runtime;

	const displayName = hasShip ? (ship.runtime.displayName ?? ship.metadata?.name ?? ship.$id.slice(-6)) : "未选择";
	const faction = hasShip ? ship.runtime.faction : null;
	const hull = hasShip ? ship.runtime.hull : 0;
	const hullMax = hasShip ? (ship.spec.maxHitPoints ?? 100) : 100;
	const hullPct = hasShip ? Math.min(100, (hull / hullMax) * 100) : 0;

	const fluxSoft = hasShip ? (ship.runtime.fluxSoft ?? 0) : 0;
	const fluxHard = hasShip ? (ship.runtime.fluxHard ?? 0) : 0;
	const fluxTotal = fluxSoft + fluxHard;
	const fluxMax = hasShip ? (ship.spec.fluxCapacity ?? 100) : 100;
	const fluxSoftPct = fluxMax > 0 ? Math.min(100, (fluxSoft / fluxMax) * 100) : 0;
	const fluxHardPct = fluxMax > 0 ? Math.min(100, (fluxHard / fluxMax) * 100) : 0;
	const fluxTotalPct = Math.min(100, fluxSoftPct + fluxHardPct);

	const handleStartEdit = useCallback(() => {
		if (!hasShip) return;
		setEditingName(ship.runtime.displayName ?? ship.metadata?.name ?? "");
		setIsEditingName(true);
	}, [hasShip, ship]);

	const handleCancelEdit = useCallback(() => {
		setIsEditingName(false);
		setEditingName("");
	}, []);

	const handleSaveName = useCallback(async () => {
		if (!hasShip || !editingName.trim()) return;
		try {
			await send("edit:token", { action: "rename", tokenId: ship.$id, displayName: editingName.trim() });
			notify.success(`已更名为 ${editingName.trim()}`);
			setIsEditingName(false);
			setEditingName("");
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "更名失败");
		}
	}, [hasShip, ship?.$id, editingName, send]);

	const overloaded = hasShip ? ship.runtime.overloaded : false;
	const shieldActive = hasShip ? ship.runtime.shield?.active : false;
	const destroyed = hasShip ? ship.runtime.destroyed : false;
	const armor = hasShip ? (ship.runtime.armor ?? []) : [];
	const armorMax = hasShip ? ship.spec.armorMaxPerQuadrant : 1;

	const headingDeg = hasShip ? Math.round(ship.runtime.heading ?? 0) : 0;
	const posX = hasShip ? Math.round(ship.runtime.position?.x ?? 0) : 0;
	const posY = hasShip ? Math.round(ship.runtime.position?.y ?? 0) : 0;

	if (!hasShip) {
		return (
			<Box className="battle-row battle-row--empty">
				<Text size="2" color="gray">选择舰船后显示信息</Text>
			</Box>
		);
	}

	return (
		<Box className="battle-row">
			{/* 列1：舰船名称 + 状态 */}
			<Box className="battle-col battle-col--fixed">
				<Box className="battle-col__header">
					<Box style={{ width: 10, height: 10, borderRadius: "50%", background: faction ? `#${FactionColors[faction]?.toString(16).padStart(6, "0")}` : "#6b8aaa", boxShadow: faction ? `0 0 8px #${FactionColors[faction]?.toString(16).padStart(6, "0")}` : "none", flexShrink: 0 }} />
					<Text size="1" weight="bold">{displayName}</Text>
					{isEditingName ? (
						<Flex align="center" gap="1">
							<TextField.Root size="1" value={editingName} onChange={(e) => setEditingName(e.target.value)} style={{ width: 100 }} />
							<IconButton size="1" variant="ghost" color="green" onClick={handleSaveName}><Check size={12} /></IconButton>
							<IconButton size="1" variant="ghost" color="red" onClick={handleCancelEdit}><X size={12} /></IconButton>
						</Flex>
					) : (
						<IconButton size="1" variant="ghost" onClick={handleStartEdit}><Edit2 size={12} /></IconButton>
					)}
				</Box>
				<Box className="battle-col__content">
					<Flex gap="1" wrap="wrap">
						{overloaded && <Badge color="red" size="1"><AlertTriangle size={10} /> 过载</Badge>}
						{shieldActive && <Badge color="blue" size="1">护盾</Badge>}
						{destroyed && <Badge color="gray" size="1">损毁</Badge>}
					</Flex>
				</Box>
			</Box>

			{/* 分隔线 */}
			<Box className="battle-divider" />

			{/* 列2：船体 */}
			<Box className="battle-col battle-col--auto">
				<Box className="battle-col__header">
					<Anchor size={12} style={{ color: "#2ecc71" }} />
					<Text size="1">船体</Text>
				</Box>
				<Box className="battle-col__content battle-col__content--horizontal">
					<Text size="1" color="gray">HP</Text>
					<Text size="2" weight="bold" style={{ color: "#cfe8ff" }}>{hull}/{hullMax}</Text>
					<Progress value={hullPct} color={hullPct > 50 ? "green" : hullPct > 25 ? "yellow" : "red"} style={{ width: 80, height: 8 }} />
				</Box>
			</Box>

			{/* 分隔线 */}
			<Box className="battle-divider" />

			{/* 列3：辐能 */}
			<Box className="battle-col battle-col--wide">
				<Box className="battle-col__header">
					<Zap size={12} style={{ color: overloaded ? "#ff4444" : "#ffaa00" }} />
					<Text size="1">辐能</Text>
					<Flex gap="1" align="center">
						<Box style={{ width: 6, height: 6, borderRadius: 2, background: "#6ab4ff" }} />
						<Text size="1" color="gray">{fluxSoft}</Text>
						<Box style={{ width: 6, height: 6, borderRadius: 2, background: "#ff6f8f" }} />
						<Text size="1" color="gray">{fluxHard}</Text>
					</Flex>
				</Box>
				<Box className="battle-col__content battle-col__content--horizontal">
					<Box className="flux-bar-container">
						<Box className="flux-bar">
							<Box className="flux-bar__fill--hard" style={{ width: `${fluxHardPct}%` }} />
							<Box className="flux-bar__fill--soft" style={{ width: `${fluxSoftPct}%`, left: `${fluxHardPct}%` }} />
							{overloaded && <Box className="flux-bar__fill--overload" style={{ width: `${fluxTotalPct}%` }} />}
						</Box>
						<Flex justify="between">
							<Text size="1" weight="bold" style={{ color: "#cfe8ff" }}>{fluxTotal}/{fluxMax}</Text>
							<Text size="1" color="gray">{fluxTotalPct.toFixed(0)}%</Text>
						</Flex>
					</Box>
				</Box>
			</Box>

			{/* 分隔线 */}
			<Box className="battle-divider" />

			{/* 列4：护甲 */}
			<Box className="battle-col battle-col--fixed">
				<Box className="battle-col__header">
					<Text size="1">护甲</Text>
				</Box>
				<Box className="battle-col__content battle-col__content--horizontal">
					{armor.length === 6 ? (
						<Box className="armor-grid">
							{armor.map((val, idx) => (
								<Box
									key={idx}
									className="armor-cell"
									style={{ background: getArmorColor(val / armorMax), opacity: val > 0 ? 1 : 0.3 }}
									title={`${QUADRANT_NAMES[idx]}: ${val}/${armorMax}`}
								>
									{val}
								</Box>
							))}
						</Box>
					) : (
						<Text size="1" color="gray">无</Text>
					)}
				</Box>
			</Box>

			{/* 分隔线 */}
			<Box className="battle-divider" />

			{/* 列5：坐标 */}
			<Box className="battle-col battle-col--auto">
				<Box className="battle-col__header">
					<Text size="1">坐标</Text>
				</Box>
				<Box className="battle-col__content battle-col__content--horizontal">
					<Text size="1" weight="bold" style={{ color: "#cfe8ff" }}>{headingDeg}°, {posX}, {posY}</Text>
					<IconButton size="1" variant="ghost" onClick={() => navigator.clipboard.writeText(`${headingDeg},${posX},${posY}`)}>
						<Copy size={12} />
					</IconButton>
				</Box>
			</Box>
		</Box>
	);
};

export default ShipInfoPanel;