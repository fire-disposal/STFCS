/**
 * ViewControlSidebarPanel - 视图控制面板（简化版）
 */

import React, { useCallback } from "react";
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
	Target,
	Camera,
} from "lucide-react";
import { Button, Flex, Box, Text, IconButton, Tooltip, Switch, Separator, ScrollArea, Card } from "@radix-ui/themes";
import { useUIStore } from "@/state/stores/uiStore";
import { CoordinateInput } from "@/ui/shared/CoordinateInput";
import { CursorInput } from "@/ui/shared/CursorInput";
import { useCameraAnimation } from "@/renderer/systems/useCameraAnimation";

type LayerKey =
	| "grid"
	| "bg"
	| "arcs"
	| "move"
	| "labels"
	| "armor"
	| "textures"
	| "weaponTextures"
	| "shieldArc"
	| "weaponLayer";

const LAYER_CONFIG: Array<{ key: LayerKey; icon: typeof Grid3X3; label: string }> = [
	{ key: "textures", icon: Layers, label: "舰船贴图" },
	{ key: "weaponTextures", icon: Crosshair, label: "武器贴图" },
	{ key: "weaponLayer", icon: Crosshair, label: "武器图层" },
	{ key: "arcs", icon: Crosshair, label: "攻击范围" },
	{ key: "shieldArc", icon: ShieldCheck, label: "护盾弧" },
	{ key: "move", icon: Navigation2, label: "移动范围" },
	{ key: "armor", icon: Shield, label: "护甲" },
	{ key: "labels", icon: Tag, label: "标签" },
	{ key: "grid", icon: Grid3X3, label: "网格" },
	{ key: "bg", icon: Image, label: "星空" },
];

const LAYER_TOGGLE_MAP: Record<LayerKey, string> = {
	grid: "grid",
	bg: "background",
	arcs: "weaponArcs",
	move: "movementRange",
	labels: "labels",
	armor: "hexagonArmor",
	textures: "shipTextures",
	weaponTextures: "weaponTextures",
	shieldArc: "shieldArc",
	weaponLayer: "weaponLayer",
};

const LAYER_ITEM_STYLE: React.CSSProperties = {
	padding: "4px 6px",
	borderRadius: 4,
	cursor: "pointer",
	transition: "background 0.15s",
};

export const ViewControlSidebarPanel: React.FC = () => {
	const {
		zoom,
		cameraPosition,
		viewRotation,
		toggles,
		setZoom,
		setCameraPosition,
		setViewRotation,
		toggle,
		mapCursor,
		setMapCursor,
	} = useUIStore();

	const layerStates: Record<LayerKey, boolean> = {
		grid: toggles.grid,
		bg: toggles.background,
		arcs: toggles.weaponArcs,
		move: toggles.movementRange,
		labels: toggles.labels,
		armor: toggles.hexagonArmor,
		textures: toggles.shipTextures,
		weaponTextures: toggles.weaponTextures,
		shieldArc: toggles.shieldArc,
		weaponLayer: toggles.weaponLayer,
	};

	const cameraAnimation = useCameraAnimation({
		onCameraChange: setCameraPosition,
		onViewRotationChange: setViewRotation,
		onZoomChange: setZoom,
		currentX: cameraPosition.x,
		currentY: cameraPosition.y,
		currentRotation: viewRotation,
		currentZoom: zoom,
	});

	const handleZoomIn = useCallback(() => setZoom(Math.min(zoom * 1.2, 5)), [zoom, setZoom]);
	const handleZoomOut = useCallback(() => setZoom(Math.max(zoom / 1.2, 0.5)), [zoom, setZoom]);
	const handleRotateLeft = useCallback(() => setViewRotation((viewRotation - 15 + 360) % 360), [viewRotation, setViewRotation]);
	const handleRotateRight = useCallback(() => setViewRotation((viewRotation + 15) % 360), [viewRotation, setViewRotation]);
	const handleResetAll = useCallback(() => {
		setCameraPosition(0, 0);
		setViewRotation(0);
		setZoom(1);
	}, [setCameraPosition, setViewRotation, setZoom]);

	const cursorX = mapCursor?.x ?? 0;
	const cursorY = mapCursor?.y ?? 0;
	const cursorR = mapCursor?.r ?? 0;

	return (
		<Flex direction="column" gap="3" style={{ height: "100%" }}>
			{/* 摄像机 */}
			<Box>
				<Flex align="center" gap="1" mb="1">
					<Camera size={12} style={{ color: "#6b8aaa" }} />
					<Text size="1" weight="bold" color="gray">摄像机</Text>
				</Flex>
				<CoordinateInput
					cameraX={cameraPosition.x}
					cameraY={cameraPosition.y}
					viewRotation={viewRotation}
					zoom={zoom}
					onCameraChange={setCameraPosition}
					onViewRotationChange={setViewRotation}
					onZoomChange={setZoom}
					animateToCoords={cameraAnimation.animateToCoords}
				/>
			</Box>

			{/* 缩放 + 旋转 */}
			<Flex gap="2" wrap="wrap" align="center">
				<Flex align="center" gap="1">
					<Tooltip content="缩小">
						<IconButton size="1" variant="soft" onClick={handleZoomOut}>
							<ZoomOut size={12} />
						</IconButton>
					</Tooltip>
					<Text size="1" weight="bold" style={{ color: "#cfe8ff", minWidth: 32, textAlign: "center" }}>
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
					<Text size="1" weight="bold" style={{ color: "#cfe8ff", minWidth: 28, textAlign: "center" }}>
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

			{/* 游标 */}
			<Box>
				<Flex align="center" gap="1" mb="1">
					<Target size={12} style={{ color: "#6b8aaa" }} />
					<Text size="1" weight="bold" color="gray">游标</Text>
				</Flex>
				<CursorInput
					cursorX={cursorX}
					cursorY={cursorY}
					cursorR={cursorR}
					onCursorChange={setMapCursor}
				/>
			</Box>

			<Separator size="4" />

			{/* 图层显示 - 使用 Card + ScrollArea */}
			<Card style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "8px" }}>
				<Flex align="center" gap="1" mb="2" style={{ flexShrink: 0 }}>
					<Layers size={12} style={{ color: "#6b8aaa" }} />
					<Text size="1" weight="bold" color="gray">图层显示</Text>
				</Flex>
				<Box style={{ flex: 1, minHeight: 0 }}>
					<ScrollArea style={{ height: "100%" }}>
						<Flex direction="column" gap="1">
							{LAYER_CONFIG.map((layer) => {
								const active = layerStates[layer.key];
								const Icon = layer.icon;
								return (
									<Flex
										key={layer.key}
										align="center"
										gap="2"
										onClick={() => toggle(LAYER_TOGGLE_MAP[layer.key])}
										style={LAYER_ITEM_STYLE}
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
					</ScrollArea>
				</Box>
			</Card>

			{/* 重置按钮 */}
			<Button size="1" variant="soft" color="amber" onClick={handleResetAll} style={{ width: "100%" }}>
				<Home size={12} /> 重置视图
			</Button>
		</Flex>
	);
};

export default ViewControlSidebarPanel;