import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WeaponJSON } from "@vt/data";
import "../overlays/ship-customization-modal.css";
import { UI_CONFIG } from "@/config/constants";

const DAMAGE_TYPE_COLORS = UI_CONFIG.COLORS.DAMAGE_TYPE_PIXI;

interface MiniWeaponPreviewProps {
	weapon: WeaponJSON | null;
	texturePreviewUrl?: string | null;
	zoom: number;
	onZoomChange: (value: number) => void;
	onTextureOffsetChange?: (deltaX: number, deltaY: number) => void;
}

const SIZE_SCALE: Record<string, number> = { SMALL: 60, MEDIUM: 80, LARGE: 100 };

function clampZoom(value: number): number {
	return Math.min(4, Math.max(0.2, value));
}

function toCssColor(color: number): string {
	return `#${color.toString(16).padStart(6, "0")}`;
}

export const MiniWeaponPreview: React.FC<MiniWeaponPreviewProps> = ({
	weapon,
	texturePreviewUrl,
	zoom,
	onZoomChange,
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

	const baseSize = SIZE_SCALE[weapon?.spec.size ?? "SMALL"] ?? 60;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		const { width, height } = size;
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
		const color = DAMAGE_TYPE_COLORS[weapon?.spec.damageType as keyof typeof DAMAGE_TYPE_COLORS] ?? 0x7b68ee;
		const cssColor = toCssColor(color);
		const scaled = baseSize * zoom;
		const half = scaled / 2;

		// 对准线
		ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(cx - half * 0.8, cy);
		ctx.lineTo(cx + half * 0.8, cy);
		ctx.moveTo(cx, cy - half * 0.8);
		ctx.lineTo(cx, cy + half * 0.8);
		ctx.stroke();

		// 中心圆与朝向箭头（船头方向向上）
		ctx.beginPath();
		ctx.arc(cx, cy, 3 * zoom, 0, Math.PI * 2);
		ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
		ctx.lineWidth = 1.5;
		ctx.stroke();

		const arrowLen = half * 0.7;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx, cy - arrowLen);
		ctx.strokeStyle = cssColor;
		ctx.lineWidth = Math.max(1.5, 2.5 * zoom);
		ctx.stroke();

		const arrowW = 6 * zoom;
		ctx.beginPath();
		ctx.moveTo(cx, cy - arrowLen);
		ctx.lineTo(cx - arrowW * 0.67, cy - arrowLen + arrowW);
		ctx.lineTo(cx + arrowW * 0.67, cy - arrowLen + arrowW);
		ctx.closePath();
		ctx.fillStyle = cssColor;
		ctx.globalAlpha = 0.85;
		ctx.fill();
		ctx.globalAlpha = 1;

		if (weapon) {
			ctx.fillStyle = "rgba(160, 200, 240, 0.75)";
			ctx.font = "11px 'Fira Code', ui-monospace, monospace";
			ctx.textAlign = "left";
			ctx.fillText(`${weapon.spec.size} / ${weapon.spec.damageType}`, 8, 16);
		}
	}, [weapon, zoom, size, baseSize]);

	const texture = weapon?.spec.texture;
	const textureScale = (texture?.scale ?? 1) * zoom;
	const textureOffsetX = (texture?.offsetX ?? 0) * zoom;
	const textureOffsetY = -(texture?.offsetY ?? 0) * zoom;

	const handleTextureMouseDown = useCallback((e: React.MouseEvent) => {
		if (!onTextureOffsetChange) return;
		e.preventDefault();
		e.stopPropagation();
		setDraggingTexture(true);
		const dragRef = { startX: e.clientX, startY: e.clientY };

		const handleMouseMove = (ev: MouseEvent) => {
			const dx = ev.clientX - dragRef.startX;
			const dy = ev.clientY - dragRef.startY;
			dragRef.startX = ev.clientX;
			dragRef.startY = ev.clientY;
			onTextureOffsetChange(-dx / zoom, -dy / zoom);
		};

		const handleMouseUp = () => {
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
							alt="weapon-texture"
							draggable={false}
						/>
					</div>
				)}
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

export default MiniWeaponPreview;
