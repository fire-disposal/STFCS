/**
 * 地图游标组件
 *
 * 显示瞄准标记，具有精确世界坐标和朝向
 * 点击地图时设置，新建对象可继承此位置
 */

import { Crosshair } from "lucide-react";
import React from "react";

interface MapCursorProps {
	x: number;
	y: number;
	heading: number;
	zoom: number;
}

export const MapCursor: React.FC<MapCursorProps> = ({ x, y, heading, zoom }) => {
	// 根据缩放调整游标大小
	const cursorSize = 40 / zoom;
	const iconSize = 24 / zoom;

	return (
		<div
			className="map-cursor"
			style={{
				position: "absolute",
				left: x,
				top: y,
				transform: `translate(-50%, -50%) rotate(${heading}deg)`,
				pointerEvents: "none",
				zIndex: 1000,
			}}
		>
			{/* 瞄准环 */}
			<div
				className="map-cursor__ring"
				style={{
					width: cursorSize,
					height: cursorSize,
					border: `2px solid rgba(74, 158, 255, 0.8)`,
					borderRadius: "50%",
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					boxShadow: "0 0 10px rgba(74, 158, 255, 0.5)",
				}}
			/>

			{/* 十字线 */}
			<div
				className="map-cursor__crosshair"
				style={{
					position: "absolute",
					left: "50%",
					top: "50%",
					transform: "translate(-50%, -50%)",
					width: iconSize,
					height: iconSize,
				}}
			>
				<Crosshair
					className="map-cursor__icon"
					style={{
						width: iconSize,
						height: iconSize,
						color: "rgba(74, 158, 255, 1)",
						filter: "drop-shadow(0 0 4px rgba(74, 158, 255, 0.8))",
					}}
				/>
			</div>

			{/* 坐标标签 */}
			<div
				className="map-cursor__label"
				style={{
					position: "absolute",
					left: "50%",
					top: `-${10 + cursorSize}px`,
					transform: "translateX(-50%)",
					backgroundColor: "rgba(6, 16, 26, 0.9)",
					border: "1px solid rgba(74, 158, 255, 0.5)",
					borderRadius: "4px",
					padding: "4px 8px",
					fontSize: `${10 / zoom}px`,
					color: "rgba(207, 232, 255, 1)",
					whiteSpace: "nowrap",
					fontFamily: "monospace",
					boxShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
				}}
			>
				({Math.round(x)}, {Math.round(y)}) {Math.round(heading)}°
			</div>
		</div>
	);
};

export default MapCursor;
