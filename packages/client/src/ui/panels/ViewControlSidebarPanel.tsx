/**
 * ViewControlSidebarPanel - 视图控制面板（侧边栏优化版）
 *
 * 紧凑纵向布局：
 * - 坐标 + 缩放 + 旋转（一行）
 * - 图层开关（紧凑列表）
 */

import React from "react";
import {
	Grid3X3,
	Image,
	Crosshair,
	Navigation2,
	Tag,
	Shield,
	Layers,
	ShieldCheck,
	ZoomIn,
	ZoomOut,
	RotateCcw,
	RotateCw,
	Home,
	Square,
} from "lucide-react";
import { Button, Flex, Box, Text, IconButton, Tooltip, Switch, Separator } from "@radix-ui/themes";
import { useUIStore } from "@/state/stores/uiStore";

type LayerKey = "grid" | "bg" | "arcs" | "move" | "labels" | "armor" | "textures" | "weaponTextures" | "shieldArc" | "mountMarkers" | "weaponMarkers";

const LAYER_CONFIG: Array<{ key: LayerKey; icon: typeof Grid3X3; label: string }> = [
	{ key: "textures", icon: Layers, label: "舰船贴图" },
	{ key: "weaponTextures", icon: Crosshair, label: "武器贴图" },
	{ key: "mountMarkers", icon: Square, label: "挂载点" },
	{ key: "weaponMarkers", icon: Crosshair, label: "武器标记" },
	{ key: "arcs", icon: Crosshair, label: "武器弧" },
	{ key: "shieldArc", icon: ShieldCheck, label: "护盾弧" },
	{ key: "move", icon: Navigation2, label: "移动范围" },
	{ key: "armor", icon: Shield, label: "护甲" },
	{ key: "labels", icon: Tag, label: "标签" },
	{ key: "grid", icon: Grid3X3, label: "网格" },
	{ key: "bg", icon: Image, label: "星空" },
];

export const ViewControlSidebarPanel: React.FC = () => {
	const {
		zoom,
		cameraPosition,
		viewRotation,
		showGrid,
		showBackground,
		showWeaponArcs,
		showMovementRange,
		showLabels,
		showHexagonArmor,
		showShipTextures,
		showWeaponTextures,
		showShieldArc,
		showMountMarkers,
		showWeaponMarkers,
		setZoom,
		setCameraPosition,
		setViewRotation,
		toggleGrid,
		toggleBackground,
		toggleWeaponArcs,
		toggleMovementRange,
		toggleLabels,
		toggleHexagonArmor,
		toggleShipTextures,
		toggleWeaponTextures,
		toggleShieldArc,
		toggleMountMarkers,
		toggleWeaponMarkers,
	} = useUIStore();

	const layerStates: Record<LayerKey, boolean> = {
		grid: showGrid, bg: showBackground, arcs: showWeaponArcs, move: showMovementRange,
		labels: showLabels, armor: showHexagonArmor,
		textures: showShipTextures, weaponTextures: showWeaponTextures, shieldArc: showShieldArc,
		mountMarkers: showMountMarkers, weaponMarkers: showWeaponMarkers,
	};

	const layerToggles: Record<LayerKey, () => void> = {
		grid: toggleGrid, bg: toggleBackground, arcs: toggleWeaponArcs, move: toggleMovementRange,
		labels: toggleLabels, armor: toggleHexagonArmor,
		textures: toggleShipTextures, weaponTextures: toggleWeaponTextures, shieldArc: toggleShieldArc,
		mountMarkers: toggleMountMarkers, weaponMarkers: toggleWeaponMarkers,
	};

	const handleZoomIn = () => setZoom(Math.min(zoom * 1.2, 5));
	const handleZoomOut = () => setZoom(Math.max(zoom / 1.2, 0.5));
	const handleRotateLeft = () => setViewRotation((viewRotation - 15 + 360) % 360);
	const handleRotateRight = () => setViewRotation((viewRotation + 15) % 360);
	const handleResetAll = () => { setCameraPosition(0, 0); setViewRotation(0); setZoom(1); };

	return (
		<Flex direction="column" gap="3" className="sidebar-panel-content">
			{/* 坐标 + 缩放 + 旋转 */}
			<Flex gap="2" wrap="wrap">
				<Flex align="center" gap="1" className="sidebar-info-row" style={{ padding: "3px 6px" }}>
					<Text size="1" style={{ color: "#6b8aaa" }}>X</Text>
					<Text size="1" weight="bold" style={{ color: "#cfe8ff", fontFamily: "'Fira Code', monospace" }}>
						{Math.round(cameraPosition.x)}
					</Text>
					<Text size="1" style={{ color: "#6b8aaa" }}>Y</Text>
					<Text size="1" weight="bold" style={{ color: "#cfe8ff", fontFamily: "'Fira Code', monospace" }}>
						{Math.round(cameraPosition.y)}
					</Text>
				</Flex>

				<Flex align="center" gap="1">
					<Tooltip content="缩小">
						<IconButton size="1" variant="soft" onClick={handleZoomOut}>
							<ZoomOut size={12} />
						</IconButton>
					</Tooltip>
					<Text size="1" weight="bold" style={{ color: "#cfe8ff", minWidth: 32 }}>
						{(zoom * 100).toFixed(0)}%
					</Text>
					<Tooltip content="放大">
						<IconButton size="1" variant="soft" onClick={handleZoomIn}>
							<ZoomIn size={12} />
						</IconButton>
					</Tooltip>
				</Flex>

				<Flex align="center" gap="1">
					<Tooltip content="左旋">
						<IconButton size="1" variant="soft" onClick={handleRotateLeft}>
							<RotateCcw size={12} />
						</IconButton>
					</Tooltip>
					<Text size="1" weight="bold" style={{ color: "#cfe8ff", minWidth: 28 }}>
						{Math.round(viewRotation)}°
					</Text>
					<Tooltip content="右旋">
						<IconButton size="1" variant="soft" onClick={handleRotateRight}>
							<RotateCw size={12} />
						</IconButton>
					</Tooltip>
				</Flex>
			</Flex>

			<Separator size="4" />

			{/* 图层开关 */}
			<Box className="sidebar-edit-section">
				<Text size="1" weight="bold" style={{ color: "#6b8aaa", marginBottom: 6 }}>图层显示</Text>
				<Flex direction="column" gap="1">
					{LAYER_CONFIG.map((layer) => {
						const active = layerStates[layer.key];
						const Icon = layer.icon;
						return (
							<Flex
								key={layer.key}
								align="center"
								gap="2"
								className="sidebar-layer-toggle"
								onClick={layerToggles[layer.key]}
								style={{ padding: "2px 4px" }}
							>
								<Icon size={12} style={{ color: active ? "#4a9eff" : "#6b8aaa" }} />
								<Text size="1" style={{ color: active ? "#cfe8ff" : "#6b8aaa", flex: 1 }}>
									{layer.label}
								</Text>
								<Switch size="1" checked={active} />
							</Flex>
						);
					})}
				</Flex>
			</Box>

			<Separator size="4" />

			{/* 重置 */}
			<Button size="1" variant="soft" color="amber" onClick={handleResetAll} style={{ width: "100%" }}>
				<Home size={12} /> 重置视图
			</Button>
		</Flex>
	);
};

export default ViewControlSidebarPanel;