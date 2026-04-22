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

	const viewToggles = [
		{ key: "grid", icon: <Grid3X3 size={12} />, label: "网格", active: showGrid, toggle: toggleGrid },
		{ key: "bg", icon: <Image size={12} />, label: "背景", active: showBackground, toggle: toggleBackground },
		{ key: "arcs", icon: <Crosshair size={12} />, label: "弧线", active: showWeaponArcs, toggle: toggleWeaponArcs },
		{ key: "move", icon: <Navigation2 size={12} />, label: "范围", active: showMovementRange, toggle: toggleMovementRange },
		{ key: "labels", icon: <Tag size={12} />, label: "标签", active: showLabels, toggle: toggleLabels },
		{ key: "fx", icon: <Sparkles size={12} />, label: "特效", active: showEffects, toggle: toggleEffects },
		{ key: "icons", icon: <Monitor size={12} />, label: "图标", active: showShipIcons, toggle: toggleShipIcons },
		{ key: "armor", icon: <Shield size={12} />, label: "护甲", active: showHexagonArmor, toggle: toggleHexagonArmor },
	];

	return (
		<Flex className="panel-row" gap="3">
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

			<Flex className="panel-section view-toggles-row" align="center" gap="1">
				{viewToggles.map((t) => (
					<Button
						key={t.key}
						size="1"
						variant={t.active ? "solid" : "soft"}
						color={t.active ? "blue" : "gray"}
						onClick={t.toggle}
						style={{ padding: "2px 4px" }}
					>
						{t.icon}
					</Button>
				))}
			</Flex>

			<Box className="panel-divider" />

			<Button size="1" variant="soft" color="amber" onClick={handleResetAll}>
				<Home size={12} /> 重置视图
			</Button>
		</Flex>
	);
};

export default ViewControlPanel;