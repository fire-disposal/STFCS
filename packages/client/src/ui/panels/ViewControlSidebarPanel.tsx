/**
 * ViewControlSidebarPanel - 视图控制面板（简化版）
 */

import React, { useCallback } from "react";
import {
	ZoomIn,
	ZoomOut,
	RotateCcw,
	RotateCw,
	Home,
	Target,
	Camera,
} from "lucide-react";
import { Button, Flex, Box, Text, IconButton, Tooltip, Separator, Card, Checkbox, ScrollArea } from "@radix-ui/themes";
import { useUIStore } from "@/state/stores/uiStore";
import { CoordinateInput } from "@/ui/shared/CoordinateInput";
import { CursorInput } from "@/ui/shared/CursorInput";
import { useCameraAnimation } from "@/renderer/systems/useCameraAnimation";

interface LayerItem {
	key: string;
	label: string;
}

const ALL_LAYER_ITEMS: LayerItem[] = [
	{ key: "textures", label: "贴图图层" },
	{ key: "weaponLayer", label: "战术视图" },
	{ key: "weaponArcs", label: "攻击范围" },
	{ key: "shieldArc", label: "护盾弧" },
	{ key: "movementRange", label: "移动范围" },
	{ key: "hexagonArmor", label: "护甲" },
	{ key: "labels", label: "标签" },
	{ key: "grid", label: "网格" },
	{ key: "background", label: "星空" },
];

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

			{/* 图层显示 - 两列勾选框 */}
			<Card style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "8px" }}>
				<Text size="1" weight="bold" color="gray" mb="2">图层显示</Text>
				<Box style={{ flex: 1, minHeight: 0 }}>
					<ScrollArea style={{ height: "100%" }}>
						<div className="layer-grid">
							{ALL_LAYER_ITEMS.map((layer) => {
								const active = toggles[layer.key as keyof typeof toggles] as boolean;
								return (
									<label
										key={layer.key}
										className="layer-grid-item"
									>
										<Checkbox
											size="1"
											checked={active}
											onCheckedChange={() => toggle(layer.key)}
										/>
										<Text size="1" style={{ color: active ? "#cfe8ff" : "#6b8aaa" }}>
											{layer.label}
										</Text>
									</label>
								);
							})}
						</div>
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