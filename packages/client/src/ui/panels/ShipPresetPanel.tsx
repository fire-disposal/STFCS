/**
 * ShipPresetPanel - 舰船预设面板（重构版）
 * 
 * 使用统一 CSS 类布局
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
import "./battle-panel-row.css";

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
				state: "READY" as const,
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
			await networkManager.send("edit:token", {
				action: "create",
				token: combatToken,
				faction: FactionEnum.PLAYER_ALLIANCE,
				position: cursorPosition,
			});
			notify.success(`已部署 ${selectedPreset.name} 到 (${Math.round(cursorPosition.x)}, ${Math.round(cursorPosition.y)})`);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "部署失败");
		}
	};

	if (loading) {
		return (
			<Box className="battle-row battle-row--empty">
				<Text size="2" color="gray">加载预设...</Text>
			</Box>
		);
	}

	return (
		<Box className="battle-row">
			{/* 列1：搜索筛选 */}
			<Box className="battle-col battle-col--fixed">
				<Box className="battle-col__header">
					<Search size={12} /> 筛选
				</Box>
				<Box className="battle-col__content">
					<Flex gap="1" direction="column">
						<TextField.Root
							size="1"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="搜索..."
							style={{ width: "100%" }}
						/>
						<Select.Root value={filterSize} onValueChange={setFilterSize}>
							<Select.Trigger style={{ width: "100%" }}>
								<Filter size={10} />
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
				</Box>
			</Box>

			<Box className="battle-divider" />

			{/* 列2：预设列表 */}
			<Box className="battle-col battle-col--wide">
				<Box className="battle-col__header">
					<Rocket size={12} /> 预设舰船 ({filteredPresets.length})
				</Box>
				<Box className="battle-col__content">
					<ScrollArea style={{ height: "100%" }}>
						<Flex gap="2" wrap="wrap">
							{filteredPresets.length === 0 ? (
								<Text size="1" color="gray">暂无预设舰船</Text>
							) : (
								filteredPresets.map((preset) => {
									const isSelected = selectedId === preset.id;
									return (
										<Box
											key={preset.id}
											onClick={() => setSelectedId(preset.id)}
											style={{
												padding: 6,
												background: isSelected ? "rgba(74, 158, 255, 0.2)" : "rgba(26, 45, 66, 0.4)",
												border: isSelected ? "1px solid rgba(74, 158, 255, 0.6)" : "1px solid rgba(43, 66, 97, 0.4)",
												borderRadius: 6,
												cursor: "pointer",
												minWidth: 80,
												transition: "all 0.15s",
											}}
										>
											<ShipPreviewCanvas token={preset.token} size={50} selected={isSelected} />
											<Text size="1" style={{
												display: "block",
												maxWidth: 70,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
												color: isSelected ? "#4fc3ff" : "#cfe8ff",
												textAlign: "center",
												marginTop: 4,
											}}>
												{preset.name}
											</Text>
										</Box>
									);
								})
							)}
						</Flex>
					</ScrollArea>
				</Box>
			</Box>

			<Box className="battle-divider" />

			{/* 列3：游标位置 */}
			<Box className="battle-col battle-col--fixed">
				<Box className="battle-col__header">
					<Target size={12} /> 游标
				</Box>
				<Box className="battle-col__content battle-col__content--horizontal">
					<Text size="1" weight="bold" style={{ color: "#cfe8ff" }}>
						({Math.round(cursorPosition.x)}, {Math.round(cursorPosition.y)})
					</Text>
				</Box>
			</Box>

			{/* 列4：选中信息 */}
			{selectedPreset && (
				<>
					<Box className="battle-divider" />
					<Box className="battle-col battle-col--narrow">
						<Box className="battle-col__header">选中</Box>
						<Box className="battle-col__content battle-col__content--horizontal">
							<Badge size="1" variant="soft">
								{HULL_SIZE_NAMES[selectedPreset.hullSize] ?? selectedPreset.hullSize}
							</Badge>
							<Badge size="1" variant="outline">
								{selectedPreset.weaponCount} 武器
							</Badge>
						</Box>
					</Box>
				</>
			)}

			{/* 部署按钮 */}
			<Button
				size="2"
				variant="solid"
				color="green"
				onClick={handleDeploy}
				disabled={!selectedPreset}
				style={{ flexShrink: 0, alignSelf: "center" }}
			>
				<Rocket size={14} /> 部署
			</Button>
		</Box>
	);
};

export default ShipPresetPanel;