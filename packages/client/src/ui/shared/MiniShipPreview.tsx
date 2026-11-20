import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InventoryToken, WeaponSlotSize } from "@vt/data";
import { UI_CONFIG } from "@/config/constants";

interface MiniShipPreviewProps {
	token: InventoryToken | null;
	zoom: number;
	onZoomChange: (value: number) => void;
	texturePreviewUrl?: string | null;
	onTextureOffsetChange?: (deltaX: number, deltaY: number) => void;
}

const MOUNT_SLOT_SIZE: Record<WeaponSlotSize, number> = {
	SMALL: 6,
	MEDIUM: 9,
	LARGE: 12,
};

const DAMAGE_COLORS: Record<string, string> = {
	KINETIC: "#ffb347",
	ENERGY: "#4a9eff",
	HIGH_EXPLOSIVE: "#ff6f8f",
	FRAGMENTATION: "#f1c40f",
	EMP: "#9b59b6",
};

function clampZoom(value: number): number {
	return Math.min(4, Math.max(0.2, value));
}

export const MiniShipPreview: React.FC<MiniShipPreviewProps> = ({
	token,
	zoom,
	onZoomChange,
	texturePreviewUrl,
	onTextureOffsetChange,
}) => {
	const hostRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [size, setSize] = useState({ width: 320, height: 240 });
	const [isDraggingTexture, setDraggingTexture] = useState(false);

	useEffect(() => {
		const el = hostRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			setSize({
				width: Math.max(1, Math.floor(entry.contentRect.width)),
				height: Math.max(1, Math.floor(entry.contentRect.height)),
			});
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const texture = token?.spec.texture;
	const textureScale = (texture?.scale ?? 1) * zoom;
	const textureOffsetX = (texture?.offsetX ?? 0) * zoom;
	const textureOffsetY = -(texture?.offsetY ?? 0) * zoom;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		const width = size.width;
		const height = size.height;
		canvas.width = Math.floor(width * dpr);
		canvas.height = Math.floor(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);

		const cx = width / 2;
		const cy = height / 2;

		// 中心十字
		ctx.strokeStyle = "rgba(120, 170, 220, 0.28)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(cx - 18, cy);
		ctx.lineTo(cx + 18, cy);
		ctx.moveTo(cx, cy - 18);
		ctx.lineTo(cx, cy + 18);
		ctx.stroke();

		if (!token) return;

		const spec = token.spec;
		const halfW = ((spec.width ?? 30) / 2) * zoom;
		const halfL = ((spec.length ?? 50) / 2) * zoom;

		// 舰体轮廓：船头向上（heading 0），舷宽 X 只影响横向
		ctx.beginPath();
		ctx.moveTo(cx, cy - halfL);
		ctx.lineTo(cx + halfW * 0.72, cy - halfL * 0.62);
		ctx.lineTo(cx + halfW, cy - halfL * 0.08);
		ctx.lineTo(cx + halfW * 0.86, cy + halfL * 0.44);
		ctx.lineTo(cx + halfW * 0.34, cy + halfL * 0.82);
		ctx.lineTo(cx - halfW * 0.34, cy + halfL * 0.82);
		ctx.lineTo(cx - halfW * 0.86, cy + halfL * 0.44);
		ctx.lineTo(cx - halfW, cy - halfL * 0.08);
		ctx.lineTo(cx - halfW * 0.72, cy - halfL * 0.62);
		ctx.closePath();
		ctx.fillStyle = "rgba(74, 158, 255, 0.14)";
		ctx.fill();
		ctx.strokeStyle = "rgba(120, 190, 255, 0.9)";
		ctx.lineWidth = 1.5;
		ctx.stroke();

		// 挂载点：position.x 左舷为正，position.y 船头为正
		for (const mount of spec.mounts ?? []) {
			const mx = cx - (mount.position?.x ?? 0) * zoom;
			const my = cy - (mount.position?.y ?? 0) * zoom;
			const radius = MOUNT_SLOT_SIZE[mount.size] ?? 6;
			const damageType = mount.weapon?.spec?.damageType ?? "";
			const color = DAMAGE_COLORS[damageType] ?? "#8ba4c7";

			ctx.beginPath();
			ctx.arc(mx, my, radius, 0, Math.PI * 2);
			ctx.fillStyle = "rgba(10, 20, 32, 0.85)";
			ctx.fill();
			ctx.strokeStyle = color;
			ctx.lineWidth = 1.2;
			ctx.stroke();

			// 朝向箭头：航海角 0 度朝上
			const facing = ((mount.facing ?? 0) - 90) * (Math.PI / 180);
			ctx.beginPath();
			ctx.moveTo(mx, my);
			ctx.lineTo(mx + Math.cos(facing) * (radius + 5), my + Math.sin(facing) * (radius + 5));
			ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
			ctx.lineWidth = 1.2;
			ctx.stroke();
		}

		// 舰种标签
		ctx.fillStyle = "rgba(160, 200, 240, 0.75)";
		ctx.font = "11px 'Fira Code', ui-monospace, monospace";
		ctx.textAlign = "left";
		ctx.fillText(`${spec.size} / ${spec.class}`, 8, 16);
	}, [token, zoom, size]);

	const dragRef = useRef<{ startX: number; startY: number } | null>(null);

	const handleTextureMouseDown = useCallback((e: React.MouseEvent) => {
		if (!onTextureOffsetChange) return;
		e.preventDefault();
		e.stopPropagation();
		setDraggingTexture(true);
		dragRef.current = { startX: e.clientX, startY: e.clientY };

		const handleMouseMove = (ev: MouseEvent) => {
			if (!dragRef.current) return;
			const dx = ev.clientX - dragRef.current.startX;
			const dy = ev.clientY - dragRef.current.startY;
			dragRef.current = { startX: ev.clientX, startY: ev.clientY };
			onTextureOffsetChange(-dx / zoom, -dy / zoom);
		};

		const handleMouseUp = () => {
			dragRef.current = null;
			setDraggingTexture(false);
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
	}, [zoom, onTextureOffsetChange]);

	const textureWrapStyle = useMemo(
		() => ({ transform: `translate(${textureOffsetX}px, ${textureOffsetY}px)` }),
		[textureOffsetX, textureOffsetY],
	);
	const textureStyle = useMemo(
		() => ({ transform: `translate(-50%, -50%) scale(${textureScale})` }),
		[textureScale],
	);

	return (
		<div className="customizer-preview-shell">
			<div
				ref={hostRef}
				className="customizer-preview-canvas"
				onWheel={(event) => {
					event.preventDefault();
					const direction = event.deltaY > 0 ? -1 : 1;
					onZoomChange(clampZoom(zoom + direction * 0.08));
				}}
			>
				<canvas ref={canvasRef} className="customizer-preview-draw" />

				{texturePreviewUrl && (
					<div
						className="customizer-preview-texture-wrap"
						style={{ ...textureWrapStyle, cursor: onTextureOffsetChange ? (isDraggingTexture ? "grabbing" : "grab") : undefined }}
						onMouseDown={handleTextureMouseDown}
					>
						<img
							src={texturePreviewUrl}
							className="customizer-preview-texture"
							style={textureStyle}
							alt="texture-preview"
							draggable={false}
						/>
					</div>
				)}

				<div className="customizer-preview-crosshair" />
			</div>

			<input
				className="customizer-range"
				type="range"
				min={0.2}
				max={4}
				step={0.01}
				value={zoom}
				onChange={(e) => onZoomChange(clampZoom(Number(e.target.value)))}
				aria-label="预览缩放"
			/>
		</div>
	);
};

export default MiniShipPreview;
