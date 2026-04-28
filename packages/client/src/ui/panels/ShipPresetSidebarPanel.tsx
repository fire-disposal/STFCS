/**
 * ShipPresetSidebarPanel - 舰船预设面板（简化版）
 */

import React, { useState, useEffect, useMemo } from "react";
import { Rocket, Search, Filter } from "lucide-react";
import { Badge, Box, Button, Flex, Text, TextField, Select, ScrollArea, Card } from "@radix-ui/themes";
import type { InventoryToken, CombatToken } from "@vt/data";
import { Faction as FactionEnum, HullSize } from "@vt/data";
import type { SocketNetworkManager } from "@/network";
import { ShipPreviewCanvas } from "./ShipPreviewCanvas";
import { notify } from "@/ui/shared/Notification";
import { useUIStore } from "@/state/stores/uiStore";
import { useGameAction } from "@/hooks/useGameAction";

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

interface ShipPresetSidebarPanelProps {
	networkManager: SocketNetworkManager;
}

const PRESET_ITEM_STYLE: React.CSSProperties = {
	padding: "6px 8px",
	borderRadius: 4,
	cursor: "pointer",
	transition: "background 0.15s, border-color 0.15s",
};

export const ShipPresetSidebarPanel: React.FC<ShipPresetSidebarPanelProps> = ({
	networkManager,
}) => {
	const { send } = useGameAction();
	const mapCursor = useUIStore((state) => state.mapCursor);
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

		const cursorPos = {
			x: mapCursor?.x ?? 0,
			y: mapCursor?.y ?? 0,
		};
		const cursorHeading = mapCursor?.r ?? 0;

		const combatToken: CombatToken = {
			...selectedPreset.token,
			runtime: {
				position: cursorPos,
				heading: cursorHeading,
				faction: FactionEnum.PLAYER_ALLIANCE,
			} as any,
		};

		try {
			await send("edit:token", {
				action: "create",
				token: combatToken,
				faction: FactionEnum.PLAYER_ALLIANCE,
				position: cursorPos,
			});
		} catch {
			// 错误已由 useGameAction 中的 notify.error 处理
		}
	};

	if (loading) {
		return (
			<Flex align="center" justify="center" style={{ height: "100%" }}>
				<Text size="2" color="gray">加载预设...</Text>
			</Flex>
		);
	}

	return (
		<Flex direction="column" gap="2" style={{ height: "100%" }}>
			{/* 搜索和筛选 */}
			<Flex gap="2" style={{ flexShrink: 0 }}>
				<TextField.Root
					size="1"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="搜索舰船..."
					style={{ flex: 1 }}
				>
					<TextField.Slot>
						<Search size={12} />
					</TextField.Slot>
				</TextField.Root>

				<Select.Root value={filterSize} onValueChange={setFilterSize}>
					<Select.Trigger style={{ minWidth: 70 }}>
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

			{/* 预设列表 */}
			<Card style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "4px" }}>
				<Box style={{ flex: 1, minHeight: 0 }}>
					<ScrollArea style={{ height: "100%" }}>
						<Flex direction="column" gap="1">
							{filteredPresets.length === 0 ? (
								<Text size="1" color="gray" style={{ textAlign: "center", padding: 16 }}>
									暂无预设舰船
								</Text>
							) : (
								filteredPresets.map((preset) => {
									const isSelected = selectedId === preset.id;
									return (
										<Flex
											key={preset.id}
											align="center"
											gap="2"
											onClick={() => setSelectedId(preset.id)}
											style={{
												...PRESET_ITEM_STYLE,
												background: isSelected ? "rgba(74, 158, 255, 0.15)" : "transparent",
												border: isSelected ? "1px solid rgba(74, 158, 255, 0.4)" : "1px solid transparent",
											}}
										>
											<ShipPreviewCanvas
												token={preset.token}
												size={32}
												selected={isSelected}
											/>
											<Box style={{ flex: 1, minWidth: 0 }}>
												<Text size="1" weight="bold" style={{
													color: isSelected ? "#4a9eff" : "#cfe8ff",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}>
													{preset.name}
												</Text>
												<Text size="1" color="gray">
													{HULL_SIZE_NAMES[preset.hullSize] ?? preset.hullSize}
												</Text>
											</Box>
											<Badge size="1" variant="soft">
												{preset.weaponCount}
											</Badge>
										</Flex>
									);
								})
							)}
						</Flex>
					</ScrollArea>
				</Box>
			</Card>

			{/* 部署按钮 */}
			<Button
				size="1"
				variant="solid"
				color="green"
				onClick={handleDeploy}
				disabled={!selectedPreset}
				style={{ width: "100%", flexShrink: 0 }}
			>
				<Rocket size={12} /> 部署选中舰船
			</Button>
		</Flex>
	);
};

export default ShipPresetSidebarPanel;