/**
 * ShipPresetPanel - 舰船预设面板
 * 横向布局，显示用户存档内的舰船配置
 * 单选卡片 + Pixi预览 + 部署按钮
 */

import React, { useState, useEffect, useMemo } from "react";
import { Rocket, Target, Search, Filter } from "lucide-react";
import { Badge, Box, Button, Flex, Text, TextField, Select, ScrollArea } from "@radix-ui/themes";
import type { InventoryToken, CombatToken } from "@vt/data";
import { Faction as FactionEnum, HullSize } from "@vt/data";
import type { SocketNetworkManager } from "@/network";
import { ShipPreviewCanvas } from "./ShipPreviewCanvas";
import { notify } from "@/ui/shared/Notification";
import { useUIStore } from "@/state/stores/uiStore";
import "./battle-panel.css";

const HULL_SIZE_NAMES: Record<string, string> = {
	[HullSize.FRIGATE]: "护卫舰",
	[HullSize.DESTROYER]: "驱逐舰",
	[HullSize.CRUISER]: "巡洋舰",
	[HullSize.CAPITAL]: "主力舰",
};

interface ShipPresetItem {
	id: string;
	token: InventoryToken;
	name: string;
	hullSize: string;
	weaponCount: number;
}

export interface ShipPresetPanelProps {
	networkManager: SocketNetworkManager;
}

export const ShipPresetPanel: React.FC<ShipPresetPanelProps> = ({
	networkManager,
}) => {
	const mapCursor = useUIStore((state) => state.mapCursor);
	const cursorPosition = useMemo(() =>
		mapCursor ? { x: mapCursor.x, y: mapCursor.y } : { x: 0, y: 0 },
		[mapCursor]
	);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [filterSize, setFilterSize] = useState<string>("all");
	const [shipPresets, setShipPresets] = useState<ShipPresetItem[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let disposed = false;
		const loadPresets = async () => {
			setLoading(true);
			const result = await networkManager.getLoadout();
			if (disposed) return;
			if (!result.success || !result.loadout) {
				notify.error(result.error || "预设加载失败");
				setShipPresets([]);
			} else {
				const presets: ShipPresetItem[] = result.loadout.ships.map((t: CombatToken) => ({
					id: t.$id,
					token: t as InventoryToken,
					name: t.metadata?.name ?? t.$id.slice(-6),
					hullSize: t.spec.size,
					weaponCount: (t.spec.mounts ?? []).filter((m) => m.weapon).length,
				}));
				setShipPresets(presets);
			}
			setLoading(false);
		};
		void loadPresets();
		return () => { disposed = true; };
	}, [networkManager]);

	const filteredPresets = useMemo(() => {
		return shipPresets.filter((preset) => {
			const matchesSearch = searchQuery === "" ||
				preset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				HULL_SIZE_NAMES[preset.hullSize]?.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesSize = filterSize === "all" || preset.hullSize === filterSize;
			return matchesSearch && matchesSize;
		});
	}, [shipPresets, searchQuery, filterSize]);

	const selectedPreset = selectedId ? shipPresets.find((p) => p.id === selectedId) : null;

	const handleDeploy = async () => {
		if (!selectedPreset) {
			notify.error("请先选择舰船预设");
			return;
		}

		const cursorHeading = mapCursor?.r ?? 0;
		const spec = selectedPreset.token.spec;

		const runtimeBase = {
			position: cursorPosition,
			heading: cursorHeading,
			hull: spec.maxHitPoints,
			armor: Array(6).fill(spec.armorMaxPerQuadrant),
			fluxSoft: 0,
			fluxHard: 0,
			overloaded: false,
			overloadTime: 1,
			destroyed: false,
			faction: FactionEnum.PLAYER_ALLIANCE,
			venting: false,
			weapons: (spec.mounts ?? []).map((m) => ({
				mountId: m.id,
				state: "READY",
				cooldownRemaining: 0,
			})),
		};

		if (spec.shield) {
			(runtimeBase as any).shield = {
				active: false,
				value: spec.shield.radius,
				direction: 0,
			};
		}

		const combatToken: CombatToken = {
			...selectedPreset.token,
			runtime: runtimeBase as any,
		};

		try {
			const { getGameActionSender } = await import("@/state/stores/gameStore");
			const sender = getGameActionSender();
			if (!sender.isAvailable()) {
				notify.error("网络未连接");
				return;
			}
			const result = await sender.send("edit:token", {
				action: "create",
				token: combatToken,
				faction: FactionEnum.PLAYER_ALLIANCE,
				position: cursorPosition,
			});
			const displayName = (result as { tokenId: string; displayName?: string }).displayName ?? selectedPreset.name;
			notify.success(`已部署 ${displayName} 到 (${Math.round(cursorPosition.x)}, ${Math.round(cursorPosition.y)})`);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "部署失败");
		}
	};

	if (loading) {
		return (
			<Flex align="center" gap="2" className="panel-row">
				<Text size="2" color="gray">加载预设...</Text>
			</Flex>
		);
	}

	return (
		<Flex className="panel-row" gap="3" style={{ minWidth: 0, flex: 1 }}>
			<Flex className="panel-section" align="center" gap="3" style={{ minWidth: 240 }}>
				<TextField.Root
					size="1"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="搜索舰船..."
					style={{ width: 130 }}
				>
					<TextField.Slot>
						<Search size={12} />
					</TextField.Slot>
				</TextField.Root>

				<Select.Root value={filterSize} onValueChange={setFilterSize}>
					<Select.Trigger style={{ minWidth: 80 }}>
						<Filter size={12} />
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="all">全部</Select.Item>
						<Select.Item value="FRIGATE">护卫舰</Select.Item>
						<Select.Item value="DESTROYER">驱逐舰</Select.Item>
						<Select.Item value="CRUISER">巡洋舰</Select.Item>
						<Select.Item value="CAPITAL">主力舰</Select.Item>
					</Select.Content>
				</Select.Root>
			</Flex>

			<Box className="panel-divider" />

			<Box style={{ flex: 1, minWidth: 0 }}>
				<ScrollArea style={{ height: 140 }}>
					<Flex gap="3" style={{ paddingRight: 8, flexWrap: "wrap" }}>
						{filteredPresets.length === 0 ? (
							<Text size="1" color="gray">暂无预设舰船</Text>
						) : (
							filteredPresets.map((preset) => (
								<Flex
									key={preset.id}
									direction="column"
									align="center"
									gap="1"
									style={{
										padding: 6,
										background: selectedId === preset.id
											? "rgba(74, 158, 255, 0.2)"
											: "rgba(26, 45, 66, 0.4)",
										border: selectedId === preset.id
											? "1px solid rgba(74, 158, 255, 0.6)"
											: "1px solid rgba(43, 66, 97, 0.4)",
										borderRadius: 6,
										cursor: "pointer",
										minWidth: 90,
									}}
									onClick={() => setSelectedId(preset.id)}
								>
									<ShipPreviewCanvas
										token={preset.token}
										size={60}
										selected={selectedId === preset.id}
									/>
									<Text size="1" style={{
										maxWidth: 80,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										color: selectedId === preset.id ? "#4fc3ff" : "#cfe8ff",
									}}>
										{preset.name}
									</Text>
								</Flex>
							))
						)}
					</Flex>
				</ScrollArea>
			</Box>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<Target size={14} />
				<Text size="1" color="gray">游标</Text>
				<Text size="1" weight="bold">
					({Math.round(cursorPosition.x)}, {Math.round(cursorPosition.y)})
				</Text>
			</Flex>

			{selectedPreset && (
				<Flex className="panel-section" align="center" gap="2">
					<Badge size="1" variant="soft">
						{HULL_SIZE_NAMES[selectedPreset.hullSize] ?? selectedPreset.hullSize}
					</Badge>
					<Badge size="1" variant="outline">
						{selectedPreset.weaponCount} 武器
					</Badge>
				</Flex>
			)}

			<Button
				size="1"
				variant="solid"
				color="green"
				onClick={handleDeploy}
				disabled={!selectedPreset}
				data-magnetic
			>
				<Rocket size={12} /> 部署
			</Button>
		</Flex>
	);
};

export default ShipPresetPanel;