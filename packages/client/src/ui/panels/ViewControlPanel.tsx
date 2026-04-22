/**
 * 视图控制面板 - 横向布局
 */

import React from "react";
import {
	Grid3X3,
	Image,
	Crosshair,
	Navigation2,
	Tag,
	Sparkles,
	Monitor,
	Shield,
	ZoomIn,
	ZoomOut,
	Maximize,
	RotateCcw,
	RotateCw,
	Home,
} from "lucide-react";
import { Button, Flex, Box, Text, IconButton } from "@radix-ui/themes";
import { useUIStore } from "@/state/stores/uiStore";
import "./battle-panel.css";

type LayerKey = "grid" | "bg" | "arcs" | "move" | "labels" | "fx" | "icons" | "armor";

const LAYER_CONFIG: Array<{ key: LayerKey; icon: typeof Grid3X3; label: string }> = [
	{ key: "grid", icon: Grid3X3, label: "网格" },
	{ key: "bg", icon: Image, label: "背景" },
	{ key: "arcs", icon: Crosshair, label: "武器弧" },
	{ key: "move", icon: Navigation2, label: "移动范围" },
	{ key: "labels", icon: Tag, label: "舰船标签" },
	{ key: "fx", icon: Sparkles, label: "特效" },
	{ key: "icons", icon: Monitor, label: "舰船图标" },
	{ key: "armor", icon: Shield, label: "护甲六边形" },
];

export const ViewControlPanel: React.FC = () => {
	const {
		zoom,
		cameraPosition,
		viewRotation,
		showGrid,
		showBackground,
		showWeaponArcs,
		showMovementRange,
		showLabels,
		showEffects,
		showShipIcons,
		showHexagonArmor,
		setZoom,
		setCameraPosition,
		setViewRotation,
		toggleGrid,
		toggleBackground,
		toggleWeaponArcs,
		toggleMovementRange,
		toggleLabels,
		toggleEffects,
		toggleShipIcons,
		toggleHexagonArmor,
	} = useUIStore();

	const layerStates: Record<LayerKey, boolean> = {
		grid: showGrid,
		bg: showBackground,
		arcs: showWeaponArcs,
		move: showMovementRange,
		labels: showLabels,
		fx: showEffects,
		icons: showShipIcons,
		armor: showHexagonArmor,
	};

	const layerToggles: Record<LayerKey, () => void> = {
		grid: toggleGrid,
		bg: toggleBackground,
		arcs: toggleWeaponArcs,
		move: toggleMovementRange,
		labels: toggleLabels,
		fx: toggleEffects,
		icons: toggleShipIcons,
		armor: toggleHexagonArmor,
	};

	const handleZoomIn = () => setZoom(Math.min(zoom * 1.2, 5));
	const handleZoomOut = () => setZoom(Math.max(zoom / 1.2, 0.5));
	const handleZoomReset = () => setZoom(1);

	const handleRotateLeft = () => setViewRotation((viewRotation - 15 + 360) % 360);
	const handleRotateRight = () => setViewRotation((viewRotation + 15) % 360);
	const handleRotateReset = () => setViewRotation(0);

	const handleResetAll = () => {
		setCameraPosition(0, 0);
		setViewRotation(0);
		setZoom(1);
	};

	return (
		<Flex className="panel-row" gap="3" style={{ width: "100%" }}>
			<Flex className="panel-section" align="center" gap="2">
				<Text size="1" color="gray">坐标</Text>
				<Text size="1" weight="bold">({Math.round(cameraPosition.x)}, {Math.round(cameraPosition.y)})</Text>
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<ZoomIn size={14} />
				<Text size="1" color="gray">缩放</Text>
				<Text size="1" weight="bold">{(zoom * 100).toFixed(0)}%</Text>
				<IconButton size="1" variant="soft" onClick={handleZoomOut}>
					<ZoomOut size={12} />
				</IconButton>
				<IconButton size="1" variant="soft" onClick={handleZoomReset}>
					<Maximize size={12} />
				</IconButton>
				<IconButton size="1" variant="soft" onClick={handleZoomIn}>
					<ZoomIn size={12} />
				</IconButton>
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2">
				<RotateCcw size={14} />
				<Text size="1" color="gray">旋转</Text>
				<Text size="1" weight="bold">{Math.round(viewRotation)}°</Text>
				<IconButton size="1" variant="soft" onClick={handleRotateLeft}>
					<RotateCcw size={12} />
				</IconButton>
				<IconButton size="1" variant="soft" onClick={handleRotateReset}>
					<Home size={12} />
				</IconButton>
				<IconButton size="1" variant="soft" onClick={handleRotateRight}>
					<RotateCw size={12} />
				</IconButton>
			</Flex>

			<Box className="panel-divider" />

			<Flex className="panel-section" align="center" gap="2" style={{ flex: 1, justifyContent: "center" }}>
				<Text size="1" weight="bold" color="gray">图层</Text>
				<Flex gap="2" wrap="wrap">
					{LAYER_CONFIG.map((layer) => {
						const active = layerStates[layer.key];
						const Icon = layer.icon;
						return (
							<Button
								key={layer.key}
								size="1"
								variant={active ? "solid" : "outline"}
								color={active ? "blue" : "gray"}
								onClick={layerToggles[layer.key]}
								style={{ minWidth: 60 }}
							>
								<Icon size={12} />
								<Text size="1">{layer.label}</Text>
							</Button>
						);
					})}
				</Flex>
			</Flex>

			<Box className="panel-divider" />

			<Button size="1" variant="soft" color="amber" onClick={handleResetAll}>
				<Home size={12} /> 重置视图
			</Button>
		</Flex>
	);
};

export default ViewControlPanel;