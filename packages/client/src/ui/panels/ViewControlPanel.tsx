/**
 * 视图控制面板 - 横向布局（加大版）
 * 使用与 Movement/Shield/ShipInfo 一致的 panel-section 模式
 */

import React from "react";
import {
	Grid3X3,
	Image,
	Crosshair,
	Navigation2,
	Tag,
	Monitor,
	Shield,
	ZoomIn,
	ZoomOut,
	Maximize,
	RotateCcw,
	RotateCw,
	Home,
	Layers,
	Bolt,
	ShieldCheck,
} from "lucide-react";
import { Button, Flex, Box, Text, IconButton, Tooltip } from "@radix-ui/themes";
import { useUIStore } from "@/state/stores/uiStore";
import "./battle-panel.css";

type LayerKey = "grid" | "bg" | "arcs" | "move" | "labels" | "icons" | "armor" | "textures" | "weaponTextures" | "shieldArc" | "flux";

const LAYER_CONFIG: Array<{ key: LayerKey; icon: typeof Grid3X3; label: string; shortLabel: string }> = [
	{ key: "grid", icon: Grid3X3, label: "网格", shortLabel: "网格" },
	{ key: "bg", icon: Image, label: "星空", shortLabel: "星空" },
	{ key: "textures", icon: Layers, label: "舰船贴图", shortLabel: "贴图" },
	{ key: "weaponTextures", icon: Crosshair, label: "武器贴图", shortLabel: "武器" },
	{ key: "arcs", icon: Crosshair, label: "武器弧", shortLabel: "弧线" },
	{ key: "shieldArc", icon: ShieldCheck, label: "护盾弧", shortLabel: "护盾" },
	{ key: "flux", icon: Bolt, label: "辐能", shortLabel: "辐能" },
	{ key: "move", icon: Navigation2, label: "移动范围", shortLabel: "移动" },
	{ key: "labels", icon: Tag, label: "标签", shortLabel: "标签" },
	{ key: "icons", icon: Monitor, label: "舰船图标", shortLabel: "图标" },
	{ key: "armor", icon: Shield, label: "护甲", shortLabel: "护甲" },
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
		showShipIcons,
		showHexagonArmor,
		showShipTextures,
		showWeaponTextures,
		showShieldArc,
		showFluxIndicators,
		setZoom,
		setCameraPosition,
		setViewRotation,
		toggleGrid,
		toggleBackground,
		toggleWeaponArcs,
		toggleMovementRange,
		toggleLabels,
		toggleShipIcons,
		toggleHexagonArmor,
		toggleShipTextures,
		toggleWeaponTextures,
		toggleShieldArc,
		toggleFluxIndicators,
	} = useUIStore();

	const layerStates: Record<LayerKey, boolean> = {
		grid: showGrid,
		bg: showBackground,
		arcs: showWeaponArcs,
		move: showMovementRange,
		labels: showLabels,
		icons: showShipIcons,
		armor: showHexagonArmor,
		textures: showShipTextures,
		weaponTextures: showWeaponTextures,
		shieldArc: showShieldArc,
		flux: showFluxIndicators,
	};

	const layerToggles: Record<LayerKey, () => void> = {
		grid: toggleGrid,
		bg: toggleBackground,
		arcs: toggleWeaponArcs,
		move: toggleMovementRange,
		labels: toggleLabels,
		icons: toggleShipIcons,
		armor: toggleHexagonArmor,
		textures: toggleShipTextures,
		weaponTextures: toggleWeaponTextures,
		shieldArc: toggleShieldArc,
		flux: toggleFluxIndicators,
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
			{/* 坐标显示 - 垂直布局 */}
			<Flex className="panel-section panel-section--vertical" gap="1" style={{ minWidth: 100 }}>
				<Text className="panel-section__label">坐标</Text>
				<Flex gap="3">
					<Flex gap="1" align="center">
						<Text size="1" style={{ color: "#6b8aaa" }}>X</Text>
						<Text className="panel-section__value">{Math.round(cameraPosition.x)}</Text>
					</Flex>
					<Flex gap="1" align="center">
						<Text size="1" style={{ color: "#6b8aaa" }}>Y</Text>
						<Text className="panel-section__value">{Math.round(cameraPosition.y)}</Text>
					</Flex>
				</Flex>
			</Flex>

			<Box className="panel-divider" />

			{/* 缩放控制 */}
			<Flex className="panel-section" align="center" gap="2">
				<ZoomIn size={16} style={{ color: "#6b8aaa", flexShrink: 0 }} />
				<Text className="panel-section__label">缩放</Text>
				<Text className="panel-section__value" style={{ minWidth: 44, textAlign: "right" }}>
					{(zoom * 100).toFixed(0)}%
				</Text>
				<Flex gap="1">
					<IconButton size="2" variant="soft" onClick={handleZoomOut} title="缩小">
						<ZoomOut size={14} />
					</IconButton>
					<IconButton size="2" variant="soft" onClick={handleZoomReset} title="重置缩放">
						<Maximize size={14} />
					</IconButton>
					<IconButton size="2" variant="soft" onClick={handleZoomIn} title="放大">
						<ZoomIn size={14} />
					</IconButton>
				</Flex>
			</Flex>

			<Box className="panel-divider" />

			{/* 旋转控制 */}
			<Flex className="panel-section" align="center" gap="2">
				<RotateCcw size={16} style={{ color: "#6b8aaa", flexShrink: 0 }} />
				<Text className="panel-section__label">旋转</Text>
				<Text className="panel-section__value" style={{ minWidth: 36, textAlign: "right" }}>
					{Math.round(viewRotation)}°
				</Text>
				<Flex gap="1">
					<IconButton size="2" variant="soft" onClick={handleRotateLeft} title="左旋 15°">
						<RotateCcw size={14} />
					</IconButton>
					<IconButton size="2" variant="soft" onClick={handleRotateReset} title="重置旋转">
						<Home size={14} />
					</IconButton>
					<IconButton size="2" variant="soft" onClick={handleRotateRight} title="右旋 15°">
						<RotateCw size={14} />
					</IconButton>
				</Flex>
			</Flex>

			<Box className="panel-divider" />

			{/* 图层切换 - 使用 Tooltip + IconButton */}
			<Flex className="panel-section" align="center" gap="2" style={{ flex: 1, minWidth: 200 }}>
				<Text className="panel-section__label">图层</Text>
				<Flex gap="1" wrap="wrap" style={{ maxHeight: 36, overflow: "hidden" }}>
					{LAYER_CONFIG.map((layer) => {
						const active = layerStates[layer.key];
						const Icon = layer.icon;
						return (
							<Tooltip key={layer.key} content={layer.label}>
								<IconButton
									size="2"
									variant={active ? "solid" : "outline"}
									color={active ? "blue" : "gray"}
									onClick={layerToggles[layer.key]}
								>
									<Icon size={14} />
								</IconButton>
							</Tooltip>
						);
					})}
				</Flex>
			</Flex>

			<Box className="panel-divider" />

			{/* 重置视图 */}
			<Button size="2" variant="soft" color="amber" onClick={handleResetAll}>
				<Home size={14} /> 重置
			</Button>
		</Flex>
	);
};

export default ViewControlPanel;
