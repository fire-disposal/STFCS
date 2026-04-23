/**
 * 舰船信息面板 - 上下三行排布
 * 支持战斗实例重命名
 */

import React, { useState, useCallback } from "react";
import { Anchor, Shield, Zap, Gauge, AlertTriangle, Edit2, Check, X } from "lucide-react";
import type { CombatToken } from "@vt/data";
import { Faction } from "@vt/data";
import { Badge, Box, Flex, Progress, Text, TextField, IconButton } from "@radix-ui/themes";
import type { SocketRoom } from "@/network";
import { notify } from "@/ui/shared/Notification";
import "./battle-panel.css";

export interface ShipInfoPanelProps {
	ship: CombatToken | null;
	room?: SocketRoom | null;
}

export const ShipInfoPanel: React.FC<ShipInfoPanelProps> = ({ ship, room }) => {
	const [isEditingName, setIsEditingName] = useState(false);
	const [editingName, setEditingName] = useState("");

	const hasShip = ship && ship.runtime;

	const displayName = hasShip ? (ship.runtime.displayName ?? ship.metadata?.name ?? ship.$id.slice(-6)) : "未选择";
	const faction = hasShip ? ship.runtime.faction : null;
	const hull = hasShip ? ship.runtime.hull : 0;
	const hullMax = hasShip ? (ship.spec.maxHitPoints ?? 100) : 100;
	const hullPct = hasShip ? Math.min(100, (hull / hullMax) * 100) : 0;

	const shieldVal = hasShip ? (ship.runtime.shield?.value ?? 0) : 0;
	const shieldMax = hasShip ? (ship.spec.shield?.upkeep ?? 100) : 100;
	const shieldPct = hasShip ? Math.min(100, (shieldVal / shieldMax) * 100) : 0;
	const shieldActive = hasShip ? (ship.runtime.shield?.active ?? false) : false;

	const fluxSoft = hasShip ? (ship.runtime.fluxSoft ?? 0) : 0;
	const fluxHard = hasShip ? (ship.runtime.fluxHard ?? 0) : 0;
	const fluxTotal = fluxSoft + fluxHard;
	const fluxMax = hasShip ? (ship.spec.fluxCapacity ?? 100) : 100;
	const fluxSoftPct = hasShip ? Math.min(100, (fluxSoft / fluxMax) * 100) : 0;
	const fluxHardPct = hasShip ? Math.min(100, (fluxHard / fluxMax) * 100) : 0;

	const phase = hasShip ? (ship.runtime.movement?.currentPhase ?? "A") : "-";
	const overloaded = hasShip ? ship.runtime.overloaded : false;
	const destroyed = hasShip ? ship.runtime.destroyed : false;

	const handleStartEdit = useCallback(() => {
		if (!hasShip) return;
		setEditingName(displayName);
		setIsEditingName(true);
	}, [hasShip, displayName]);

	const handleCancelEdit = useCallback(() => {
		setIsEditingName(false);
		setEditingName("");
	}, []);

	const handleSaveName = useCallback(async () => {
		if (!hasShip || !room || !editingName.trim()) return;
		
		try {
			await room.send("edit:token", {
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
	}, [hasShip, room, ship?.$id, editingName]);

	return (
		<Flex direction="column" gap="2" className="panel-content">
			<Flex className="panel-row" gap="3" align="center">
				<Text size="2">
					{faction === Faction.PLAYER ? "🔵" : faction === Faction.NEUTRAL ? "⚪" : faction === Faction.ENEMY ? "🔴" : "⚪"}
				</Text>
				
				{isEditingName ? (
					<Flex align="center" gap="1">
						<TextField.Root
							size="1"
							value={editingName}
							onChange={(e) => setEditingName(e.target.value)}
							style={{ width: 120 }}
						/>
						<IconButton size="1" variant="ghost" color="green" onClick={handleSaveName}>
							<Check size={12} />
						</IconButton>
						<IconButton size="1" variant="ghost" color="red" onClick={handleCancelEdit}>
							<X size={12} />
						</IconButton>
					</Flex>
				) : (
					<Flex align="center" gap="1">
						<Text size="2" weight="bold" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
							{hasShip ? displayName : "请选择舰船"}
						</Text>
						{hasShip && room && (
							<IconButton size="1" variant="ghost" onClick={handleStartEdit}>
								<Edit2 size={10} />
							</IconButton>
						)}
					</Flex>
				)}
				
				{overloaded && <Badge color="red" size="1"><AlertTriangle size={10} /> 过载</Badge>}
				{shieldActive && <Badge color="blue" size="1">护盾</Badge>}
				{destroyed && <Badge color="gray" size="1">损毁</Badge>}
				<Badge size="1" variant="soft">Phase {phase}</Badge>
			</Flex>

			<Flex className="panel-row" gap="3" align="center">
				<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 200 }}>
					<Anchor size={14} />
					<Text size="1" className="panel-section__label">船体</Text>
					<Progress value={hullPct} color={hullPct > 50 ? "green" : hullPct > 25 ? "yellow" : "red"} style={{ width: 120 }} />
					<Text size="1" className="panel-section__value">{hasShip ? `${hull}/${hullMax}` : "NA"}</Text>
				</Flex>

				<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 200 }}>
					<Shield size={14} />
					<Text size="1" className="panel-section__label">护盾</Text>
					<Progress value={shieldPct} color="blue" style={{ width: 120 }} />
					<Text size="1" className="panel-section__value">{hasShip ? `${shieldVal}/${shieldMax}` : "NA"}</Text>
				</Flex>
			</Flex>

			<Flex className="panel-row" gap="3" align="center">
				<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 200 }}>
					<Zap size={14} />
					<Text size="1" className="panel-section__label">辐能</Text>
					<Box style={{ width: 120, height: 16, position: "relative", borderRadius: 4, overflow: "hidden", background: "rgba(43, 66, 97, 0.4)" }}>
						<Box style={{
							position: "absolute",
							left: 0,
							top: 0,
							height: "100%",
							width: `${fluxSoftPct}%`,
							background: "linear-gradient(90deg, #1e3a5f, #3a6ea5)",
							borderRadius: 4,
						}} />
						<Box style={{
							position: "absolute",
							left: `${fluxSoftPct}%`,
							top: 0,
							height: "100%",
							width: `${fluxHardPct}%`,
							background: "linear-gradient(90deg, #0a1930, #1a3050)",
							borderRadius: "0 4px 4px 0",
						}} />
					</Box>
					<Text size="1" className="panel-section__value">{hasShip ? `${fluxTotal}/${fluxMax}` : "NA"}</Text>
				</Flex>

				<Flex className="panel-section" align="center" gap="2">
					<Text size="1" className="panel-section__label" style={{ color: "#3a6ea5" }}>软</Text>
					<Text size="1" className="panel-section__value" style={{ color: "#3a6ea5" }}>{hasShip ? fluxSoft : "NA"}</Text>
					<Text size="1" className="panel-section__label" style={{ color: "#1a3050" }}>硬</Text>
					<Text size="1" className="panel-section__value" style={{ color: "#1a3050" }}>{hasShip ? fluxHard : "NA"}</Text>
				</Flex>
			</Flex>

			<Flex className="panel-row" gap="3" align="center">
				<Flex className="panel-section" align="center" gap="2">
					<Gauge size={14} />
					<Text size="1" className="panel-section__label">朝向</Text>
					<Text size="1" className="panel-section__value">{hasShip ? `${Math.round(ship.runtime.heading ?? 0)}°` : "NA"}</Text>
				</Flex>

				<Flex className="panel-section" align="center" gap="2">
					<Text size="1" className="panel-section__label">位置</Text>
					<Text size="1" className="panel-section__value">
						{hasShip ? `(${Math.round(ship.runtime.position?.x ?? 0)}, ${Math.round(ship.runtime.position?.y ?? 0)})` : "NA"}
					</Text>
				</Flex>
			</Flex>
		</Flex>
	);
};

export default ShipInfoPanel;