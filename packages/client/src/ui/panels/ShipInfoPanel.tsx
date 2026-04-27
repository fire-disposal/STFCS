/**
 * 舰船信息面板 - 两行布局
 * 支持战斗实例重命名
 * 
 * 使用 useSelectedShip hook 统一获取选中舰船
 */

import React, { useState, useCallback } from "react";
import { Anchor, Zap, AlertTriangle, Edit2, Check, X, Copy } from "lucide-react";
import { FactionColors } from "@vt/data";
import { Badge, Box, Flex, Progress, Text, TextField, IconButton } from "@radix-ui/themes";
import { notify } from "@/ui/shared/Notification";
import { useSelectedShip } from "@/hooks/useSelectedShip";
import { useGameAction } from "@/hooks/useGameAction";
import "./battle-panel.css";

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
			await send("edit:token", {
				action: "rename",
				tokenId: ship.$id,
				displayName: editingName.trim(),
			});
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

	return (
		<Flex direction="column" gap="2" className="panel-content">
			{/* 第一行：舰船名称 + 状态徽章 + 朝向 + 位置 */}
			<Flex className="panel-row" gap="3" align="center">
				<Flex className="panel-section" align="center" gap="2">
					{faction && (
						<Box
							style={{
								width: 10,
								height: 10,
								borderRadius: "50%",
								background: `#${FactionColors[faction]?.toString(16).padStart(6, "0")}`,
								boxShadow: `0 0 8px #${FactionColors[faction]?.toString(16).padStart(6, "0")}`,
								flexShrink: 0,
							}}
						/>
					)}

					{isEditingName ? (
						<Flex align="center" gap="1">
							<TextField.Root
								size="2"
								value={editingName}
								onChange={(e) => setEditingName(e.target.value)}
								style={{ width: 140 }}
							/>
							<IconButton size="1" variant="ghost" color="green" onClick={handleSaveName}>
								<Check size={14} />
							</IconButton>
							<IconButton size="1" variant="ghost" color="red" onClick={handleCancelEdit}>
								<X size={14} />
							</IconButton>
						</Flex>
					) : (
						<Flex align="center" gap="1">
							<Text size="3" weight="bold" style={{ color: "#cfe8ff", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
								{hasShip ? displayName : "请选择舰船"}
							</Text>
							{hasShip && (
								<IconButton size="1" variant="ghost" onClick={handleStartEdit}>
									<Edit2 size={12} />
								</IconButton>
							)}
						</Flex>
					)}
				</Flex>

				<Box className="panel-divider" />

				<Flex className="panel-section" align="center" gap="2">
					{overloaded && <Badge color="red" size="2"><AlertTriangle size={12} /> 过载</Badge>}
					{shieldActive && <Badge color="blue" size="2">护盾</Badge>}
					{destroyed && <Badge color="gray" size="2">损毁</Badge>}
				</Flex>

				<Box className="panel-divider" />

				<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 0 }}>
					<Text size="1" style={{ color: "#6b8aaa", fontWeight: 600, whiteSpace: "nowrap" }}>坐标</Text>
					<div className="cursor-coordinate-input__row" style={{ height: 26, gap: 4, flex: 1, maxWidth: 260 }}>
						<div
							style={{
								flex: 1,
								display: "flex",
								alignItems: "center",
								padding: "2px 8px",
								height: "100%",
								background: "rgba(6, 16, 26, 0.8)",
								border: "1px solid rgba(74, 158, 255, 0.2)",
								color: "#cfe8ff",
								fontSize: 10,
								fontFamily: "'Consolas', 'Monaco', monospace",
							}}
						>
							{hasShip ? `${headingDeg}°, ${posX}, ${posY}` : "NA"}
						</div>
						<button
							className="cursor-coordinate-input__btn cursor-coordinate-input__btn--copy"
							style={{ minWidth: 50, padding: "4px 6px", height: "100%", fontSize: 9 }}
							onClick={() => navigator.clipboard.writeText(
								hasShip ? `${headingDeg},${posX},${posY}` : ""
							)}
							data-magnetic
						>
							<Copy size={10} />
							<span className="cursor-coordinate-input__btn-text">复制</span>
						</button>
					</div>
				</Flex>
			</Flex>

			{/* 第二行：船体 | 辐能 | 护甲 */}
			<Flex className="panel-row" gap="3" align="center">
				{/* 船体 */}
				<Flex className="panel-section" align="center" gap="3" style={{ minWidth: 180 }}>
					<Anchor size={18} style={{ color: "#2ecc71" }} />
					<Flex direction="column" gap="1" style={{ flex: 1 }}>
						<Flex justify="between" align="center">
							<Text size="2" style={{ color: "#6b8aaa", fontWeight: 600 }}>船体</Text>
							<Text size="2" weight="bold" style={{ color: "#cfe8ff", fontFamily: "'Fira Code', monospace" }}>
								{hasShip ? `${hull}/${hullMax}` : "NA"}
							</Text>
						</Flex>
						<Progress
							value={hullPct}
							color={hullPct > 50 ? "green" : hullPct > 25 ? "yellow" : "red"}
							style={{ width: "100%", height: 10 }}
						/>
					</Flex>
				</Flex>

				<Box className="panel-divider" />

				{/* 辐能 */}
				<Flex className="panel-section panel-section--vertical" gap="1" style={{ minWidth: 220, flex: 1 }}>
					<Flex justify="between" align="center" style={{ width: "100%" }}>
						<Flex align="center" gap="2">
							<Zap size={16} style={{ color: overloaded ? "#ff4444" : "#ffaa00" }} />
							<Text size="2" style={{ color: "#6b8aaa", fontWeight: 600 }}>辐能</Text>
						</Flex>
						<Flex gap="2" align="center">
							<Flex gap="1" align="center">
								<Box style={{ width: 8, height: 8, borderRadius: 2, background: "#6ab4ff" }} />
								<Text size="1" style={{ color: "#8ba4c7" }}>{fluxSoft}</Text>
							</Flex>
							<Flex gap="1" align="center">
								<Box style={{ width: 8, height: 8, borderRadius: 2, background: "#ff6f8f" }} />
								<Text size="1" style={{ color: "#8ba4c7" }}>{fluxHard}</Text>
							</Flex>
						</Flex>
					</Flex>
					<Box className="flux-bar-container" style={{ width: "100%", minWidth: 0 }}>
						<Box className="flux-bar" style={{ height: 16 }}>
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
							<Text size="2" weight="bold" style={{ color: "#cfe8ff", fontFamily: "'Fira Code', monospace" }}>
								{fluxTotal}/{fluxMax}
							</Text>
							<Text size="1" style={{ color: overloaded ? "#ff4444" : "#6b8aaa" }}>
								{fluxTotalPct.toFixed(0)}%
							</Text>
						</Flex>
					</Box>
				</Flex>

				<Box className="panel-divider" />

				{/* 护甲象限 - 紧凑一行 */}
				<Flex className="panel-section" align="center" gap="1">
					<Text size="1" style={{ color: "#6b8aaa", fontWeight: 600, marginRight: 4 }}>护甲</Text>
					{armor.length === 6 ? (
						<Flex gap="1">
							{armor.map((val, idx) => {
								const pct = val / armorMax;
								return (
									<Box
										key={idx}
										style={{
											width: 24,
											height: 24,
											borderRadius: 3,
											background: getArmorColor(pct),
											opacity: pct > 0 ? 1 : 0.3,
											border: "1px solid rgba(255,255,255,0.1)",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											fontSize: 10,
											fontWeight: 600,
											color: "#fff",
										}}
										title={`${QUADRANT_NAMES[idx]}: ${val}/${armorMax}`}
									>
										{val}
									</Box>
								);
							})}
						</Flex>
					) : (
						<Text size="1" style={{ color: "#4a5568" }}>无</Text>
					)}
				</Flex>
			</Flex>
		</Flex>
	);
};

export default ShipInfoPanel;
