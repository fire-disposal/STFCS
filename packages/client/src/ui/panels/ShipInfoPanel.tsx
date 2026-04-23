/**
 * 舰船信息面板 - 横向布局
 * 支持战斗实例重命名
 */

import React, { useState, useCallback } from "react";
import { Anchor, Shield, Zap, Gauge, AlertTriangle, Edit2, Check, X } from "lucide-react";
import type { ShipViewModel } from "@/renderer";
import { Faction } from "@vt/data";
import { Badge, Box, Flex, Progress, Text, TextField, IconButton } from "@radix-ui/themes";
import type { SocketRoom } from "@/network";
import { notify } from "@/ui/shared/Notification";
import "./battle-panel.css";

export interface ShipInfoPanelProps {
	ship: ShipViewModel | null;
	room?: SocketRoom | null;
}

export const ShipInfoPanel: React.FC<ShipInfoPanelProps> = ({ ship, room }) => {
	const [isEditingName, setIsEditingName] = useState(false);
	const [editingName, setEditingName] = useState("");

	const hasShip = ship && ship.runtime;

	const displayName = hasShip ? (ship.runtime.displayName ?? ship.metadata?.name ?? ship.id.slice(-6)) : "未选择";
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
	const fluxPct = hasShip ? Math.min(100, (fluxTotal / fluxMax) * 100) : 0;

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
				tokenId: ship.id,
				displayName: editingName.trim(),
			});
			notify.success(`已更名为 ${editingName.trim()}`);
			setIsEditingName(false);
			setEditingName("");
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "更名失败");
		}
	}, [hasShip, room, ship?.id, editingName]);

	return (
		<Flex className="panel-row" gap="3">
			<Flex className="panel-section" align="center" gap="2" style={{ minWidth: 100 }}>
				<Text size="2">
					{faction === Faction.PLAYER ? "🔵" : faction === Faction.NEUTRAL ? "⚪" : faction === Faction.ENEMY ? "🔴" : "⚪"}
				</Text>
				
				{isEditingName ? (
					<Flex align="center" gap="1">
						<TextField.Root
							size="1"
							value={editingName}
							onChange={(e) => setEditingName(e.target.value)}
							style={{ width: 100 }}
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
						<Text size="2" weight="bold" style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>
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

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Anchor size={14} />
				<Text size="1" className="panel-section__label">船体</Text>
				<Progress value={hullPct} color={hullPct > 50 ? "green" : hullPct > 25 ? "yellow" : "red"} style={{ width: 80 }} />
				<Text size="1" className="panel-section__value">{hasShip ? `${hull}/${hullMax}` : "NA"}</Text>
			</Flex>

			<Flex className="panel-section" align="center" gap="2">
				<Shield size={14} />
				<Text size="1" className="panel-section__label">护盾</Text>
				<Progress value={shieldPct} color="blue" style={{ width: 80 }} />
				<Text size="1" className="panel-section__value">{hasShip ? `${shieldVal}/${shieldMax}` : "NA"}</Text>
			</Flex>

			<Flex className="panel-section" align="center" gap="2">
				<Zap size={14} />
				<Text size="1" className="panel-section__label">通量</Text>
				<Progress value={fluxPct} color="purple" style={{ width: 80 }} />
				<Text size="1" className="panel-section__value">{hasShip ? `${fluxTotal}/${fluxMax}` : "NA"}</Text>
			</Flex>

			<Box className="panel-divider" />

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
	);
};

export default ShipInfoPanel;