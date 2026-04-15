/**
 * 浮动地图控制面板
 *
 * 提供地图导航和微调功能：
 * - 视图旋转
 * - 定位坐标
 * - 地图平移
 * - 星区位置导航
 *
 * 样式: game-panels.css (floating-panel 类)
 */

import type { ShipState } from "@vt/types";
import { Compass } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useSelectionStore } from "@/store/selectionStore";
import { useUIStore } from "@/store/uiStore";
import {
	calculateViewRotationForAlignment,
	normalizeAngle,
	normalizeRotation,
} from "@/utils/coordinateSystem";
import { formatPosition } from "@/utils/spaceNav";

const STORAGE_KEY = "stfcs_floating_map_controls_open";

interface FloatingMapControlsProps {
	selectedShip?: ShipState | null;
}

export const FloatingMapControls: React.FC<FloatingMapControlsProps> = ({ selectedShip }) => {
	const [isOpen, setIsOpen] = useState(true);
	const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
	const [targetX, setTargetX] = useState("0");
	const [targetY, setTargetY] = useState("0");

	const {
		cameraPosition,
		zoom,
		viewRotation,
		coordinatePrecision,
		setCameraPosition,
		setZoom,
		setViewRotation,
		resetViewRotation,
	} = useUIStore();

	const { mouseWorldX, mouseWorldY } = useSelectionStore();

	useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (stored !== null) setIsOpen(stored === "true");
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(STORAGE_KEY, String(isOpen));
	}, [isOpen]);

	useEffect(() => {
		setTargetX(String(Math.round(mouseWorldX)));
		setTargetY(String(Math.round(mouseWorldY)));
	}, [mouseWorldX, mouseWorldY]);

	useEffect(() => {
		if (!copyFeedback) return;
		const timer = window.setTimeout(() => setCopyFeedback(null), 1200);
		return () => window.clearTimeout(timer);
	}, [copyFeedback]);

	const cameraLabel = useMemo(() => {
		return formatPosition(cameraPosition.x, cameraPosition.y, coordinatePrecision);
	}, [cameraPosition.x, cameraPosition.y, coordinatePrecision]);

	const pointerLabel = useMemo(() => {
		return formatPosition(mouseWorldX, mouseWorldY, coordinatePrecision);
	}, [mouseWorldX, mouseWorldY, coordinatePrecision]);

	const pointerAngle = useMemo(() => normalizeAngle(viewRotation), [viewRotation]);

	const moveCamera = useCallback(
		(deltaX: number, deltaY: number) => {
			setCameraPosition(cameraPosition.x + deltaX, cameraPosition.y + deltaY);
		},
		[cameraPosition.x, cameraPosition.y, setCameraPosition]
	);

	const applyTargetNavigation = useCallback(() => {
		const x = Number(targetX);
		const y = Number(targetY);
		if (!Number.isFinite(x) || !Number.isFinite(y)) return;
		setCameraPosition(x, y);
	}, [targetX, targetY, setCameraPosition]);

	const alignToShip = useCallback(() => {
		if (!selectedShip) return;
		setViewRotation(calculateViewRotationForAlignment(selectedShip.transform.heading));
	}, [selectedShip, setViewRotation]);

	const rotateBy = useCallback(
		(delta: number) => {
			setViewRotation(normalizeRotation(viewRotation + delta));
		},
		[setViewRotation, viewRotation]
	);

	const copyText = useCallback(async (text: string, label: string) => {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
			} else {
				const textarea = document.createElement("textarea");
				textarea.value = text;
				textarea.style.position = "fixed";
				textarea.style.opacity = "0";
				document.body.appendChild(textarea);
				textarea.focus();
				textarea.select();
				document.execCommand("copy");
				document.body.removeChild(textarea);
			}
			setCopyFeedback(`${label} 已复制`);
		} catch {
			setCopyFeedback("复制失败");
		}
	}, []);

	const copyPointerPosition = useCallback(() => {
		copyText(
			`X=${Math.round(mouseWorldX)}, Y=${Math.round(mouseWorldY)}, Rotation=${Math.round(viewRotation)}°`,
			"定位信息"
		);
	}, [copyText, mouseWorldX, mouseWorldY, viewRotation]);

	const copyPointerAngle = useCallback(() => {
		copyText(`${Math.round(viewRotation)}°`, "角度");
	}, [copyText, viewRotation]);

	return (
		<div className="floating-panel">
			<button className="floating-panel__toggle" onClick={() => setIsOpen((open) => !open)}>
				{isOpen ? "收起地图控制" : "展开地图控制"}
			</button>

			{isOpen && (
				<div className="floating-panel__content">
					<div className="floating-panel__header">
						<div className="floating-panel__title">
							<Compass className="floating-panel__title-icon" />
							地图导航 / 微调
						</div>
						<div className="floating-panel__actions">
							<button
								className="floating-panel__tiny-btn"
								onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
							>
								-
							</button>
							<button
								className="floating-panel__tiny-btn"
								onClick={() => setZoom(Math.min(3, zoom + 0.1))}
							>
								+
							</button>
						</div>
					</div>

					<div className="floating-panel__body">
						{/* 视图旋转 */}
						<div className="map-section">
							<div className="map-section__title">视图旋转</div>
							<div className="map-row">
								<span className="map-value">当前 {Math.round(viewRotation)}°</span>
								<button className="map-nav-btn map-nav-btn--ghost" onClick={() => rotateBy(-15)}>
									-15°
								</button>
								<button className="map-nav-btn map-nav-btn--ghost" onClick={() => rotateBy(-5)}>
									-5°
								</button>
								<button className="map-nav-btn map-nav-btn--ghost" onClick={() => rotateBy(5)}>
									+5°
								</button>
								<button className="map-nav-btn map-nav-btn--ghost" onClick={() => rotateBy(15)}>
									+15°
								</button>
								<button className="map-nav-btn map-nav-btn--secondary" onClick={resetViewRotation}>
									重置
								</button>
							</div>
							<div className="map-row mt-8">
								<button
									className="map-nav-btn map-nav-btn--secondary"
									onClick={alignToShip}
									disabled={!selectedShip}
								>
									对齐舰船朝向
								</button>
								<span className="map-hint">
									这是备选微调入口，主视图保持稳定，旋转仅用于战术校正。
								</span>
							</div>
						</div>

						{/* 定位坐标 */}
						<div className="map-section">
							<div className="map-section__title">定位坐标</div>
							<div className="map-field">
								<div className="map-field__row">
									<div>
										<div className="map-field__title">当前指针世界坐标</div>
										<div className="map-field__value">{pointerLabel}</div>
									</div>
									<button className="map-copy-btn" onClick={copyPointerPosition}>
										复制
									</button>
								</div>
								<div className="map-field__row">
									<div>
										<div className="map-field__title">继承视图旋转角度</div>
										<div className="map-field__value">{Math.round(pointerAngle)}°</div>
									</div>
									<button className="map-copy-btn" onClick={copyPointerAngle}>
										复制角度
									</button>
								</div>
								<div className="map-row">
									<button
										className="map-nav-btn map-nav-btn--secondary"
										onClick={copyPointerPosition}
									>
										复制定位
									</button>
									<span className="map-hint">实时跟随鼠标更新，适合快速标记和转发坐标。</span>
								</div>
							</div>
						</div>

						{/* 地图平移 */}
						<div className="map-section">
							<div className="map-section__title">地图平移</div>
							<div className="map-row">
								<button className="map-nav-btn" onClick={() => moveCamera(-250, 0)}>
									←
								</button>
								<button className="map-nav-btn" onClick={() => moveCamera(250, 0)}>
									→
								</button>
								<button className="map-nav-btn" onClick={() => moveCamera(0, -250)}>
									↑
								</button>
								<button className="map-nav-btn" onClick={() => moveCamera(0, 250)}>
									↓
								</button>
								<button
									className="map-nav-btn map-nav-btn--secondary"
									onClick={() => setCameraPosition(0, 0)}
								>
									回中
								</button>
							</div>
							<div className="map-hint mt-8">支持直接拖拽地图；这里是精调补充，不影响主交互。</div>
						</div>

						{/* 星区位置导航 */}
						<div className="map-section">
							<div className="map-section__title">星区位置导航</div>
							<div className="map-nav-grid">
								<div>
									<div className="map-label">X 坐标</div>
									<input
										className="map-input"
										value={targetX}
										onChange={(e) => setTargetX(e.target.value)}
										inputMode="decimal"
									/>
								</div>
								<div>
									<div className="map-label">Y 坐标</div>
									<input
										className="map-input"
										value={targetY}
										onChange={(e) => setTargetY(e.target.value)}
										inputMode="decimal"
									/>
								</div>
							</div>
							<div className="map-row mt-8">
								<button className="map-nav-btn" onClick={applyTargetNavigation}>
									居中到坐标
								</button>
								<button
									className="map-nav-btn map-nav-btn--secondary"
									onClick={() => {
										setTargetX(String(Math.round(cameraPosition.x)));
										setTargetY(String(Math.round(cameraPosition.y)));
									}}
								>
									填入当前视图
								</button>
							</div>
							<div className="map-hint mt-8">当前中心：{cameraLabel}</div>
						</div>

						{/* 选中舰船 */}
						{selectedShip && (
							<div className="map-section">
								<div className="map-section__title">选中舰船</div>
								<div className="map-value">
									{selectedShip.id.slice(-6)} · 朝向 {Math.round(selectedShip.transform.heading)}°
								</div>
								<div className="map-hint mt-6">用于快速对齐视角，作为主导航的备选工具。</div>
							</div>
						)}

						{copyFeedback && <div className="map-feedback">{copyFeedback}</div>}
					</div>
				</div>
			)}
		</div>
	);
};

export default FloatingMapControls;
