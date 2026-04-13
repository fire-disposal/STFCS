/**
 * 视图控制面板组件
 *
 * 提供详细的视图控制功能：
 * - 坐标显示和输入调整
 * - 角度显示和旋转控制
 * - 缩放级别显示和控制
 * - 图层显示控制（网格、背景、武器弧、移动范围）
 * - 视图操作（重置、归零等）
 */

import { CursorCoordinateInput } from "@/components/map/CursorCoordinateInput";
import { CoordinateInput } from "@/components/ui/CoordinateInput";
import type { UseCameraAnimationResult } from "@/hooks/useCameraAnimation";
import {
	Crosshair,
	Grid3X3,
	Home,
	Image,
	Maximize,
	Monitor,
	Move,
	Navigation2,
	RotateCcw,
	RotateCw,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import React from "react";

interface ViewControlPanelProps {
	zoom: number;
	cameraX: number;
	cameraY: number;
	viewRotation: number;
	showGrid: boolean;
	showBackground: boolean;
	showWeaponArcs: boolean;
	showMovementRange: boolean;
	onZoomChange: (zoom: number) => void;
	onCameraChange: (x: number, y: number) => void;
	onViewRotationChange: (rotation: number) => void;
	onToggleGrid: () => void;
	onToggleBackground: () => void;
	onToggleWeaponArcs: () => void;
	onToggleMovementRange: () => void;
	onResetView: () => void;
	cameraAnimation?: UseCameraAnimationResult;
	mapCursor?: { x: number; y: number; heading: number } | null;
	onSetMapCursor: (x: number, y: number, heading: number) => void;
	onClearMapCursor: () => void;
	cursorR?: number | null;
}

export const ViewControlPanel: React.FC<ViewControlPanelProps> = ({
	zoom,
	cameraX,
	cameraY,
	viewRotation,
	showGrid,
	showBackground,
	showWeaponArcs,
	showMovementRange,
	onZoomChange,
	onCameraChange,
	onViewRotationChange,
	onToggleGrid,
	onToggleBackground,
	onToggleWeaponArcs,
	onToggleMovementRange,
	onResetView,
	cameraAnimation,
	mapCursor,
	onSetMapCursor,
	onClearMapCursor,
	cursorR,
}) => {
	// 缩放控制
	const handleZoomIn = () => {
		onZoomChange(Math.min(zoom * 1.2, 5));
	};

	const handleZoomOut = () => {
		onZoomChange(Math.max(zoom / 1.2, 0.1));
	};

	const handleZoomReset = () => {
		onZoomChange(1);
	};

	// 旋转控制
	const handleRotateLeft = () => {
		onViewRotationChange((viewRotation - 15 + 360) % 360);
	};

	const handleRotateRight = () => {
		onViewRotationChange((viewRotation + 15) % 360);
	};

	const handleRotateReset = () => {
		onViewRotationChange(0);
	};

	// 视图归零
	const handleResetAll = () => {
		onCameraChange(0, 0);
		onViewRotationChange(0);
		onZoomChange(1);
	};

	// 视图预设
	const viewPresets = [
		{ name: "全局", zoom: 0.5, x: 0, y: 0, rotation: 0 },
		{ name: "标准", zoom: 1, x: 0, y: 0, rotation: 0 },
		{ name: "局部", zoom: 2, x: 0, y: 0, rotation: 0 },
		{ name: "细节", zoom: 3, x: 0, y: 0, rotation: 0 },
	];

	const applyPreset = (preset: (typeof viewPresets)[0]) => {
		onZoomChange(preset.zoom);
		onCameraChange(preset.x, preset.y);
		onViewRotationChange(preset.rotation);
	};

	return (
		<div className="view-control-panel">
			{/* 视图状态概览 */}
			<div className="view-status-bar">
				<div className="view-status-item">
					<span className="view-status-label">坐标</span>
					<span className="view-status-value">
						({Math.round(cameraX)}, {Math.round(cameraY)})
					</span>
				</div>
				<div className="view-status-divider" />
				<div className="view-status-item">
					<span className="view-status-label">缩放</span>
					<span className="view-status-value">{zoom.toFixed(2)}x</span>
				</div>
				<div className="view-status-divider" />
				<div className="view-status-item">
					<span className="view-status-label">旋转</span>
					<span className="view-status-value">{Math.round(viewRotation)}°</span>
				</div>
			</div>

			{/* 视图信息区块 */}
			<div className="view-section">
				<div className="view-section__title">
					<Monitor className="view-section__icon" />
					<span>视图信息</span>
				</div>

				{/* 坐标信息 */}
				<div className="view-field-group">
					<div className="view-field__label">
						<Navigation2 className="view-field__icon" />
						<span>相机坐标</span>
					</div>
					{/* 一体化坐标输入组件 */}
					<CoordinateInput
						cameraX={cameraX}
						cameraY={cameraY}
						viewRotation={viewRotation}
						zoom={zoom}
						onCameraChange={onCameraChange}
						onViewRotationChange={onViewRotationChange}
						onZoomChange={onZoomChange}
						animateToCoords={cameraAnimation?.animateToCoords}
						worldBounds={{
							minX: -10000,
							maxX: 10000,
							minY: -10000,
							maxY: 10000,
							minZoom: 0.1,
							maxZoom: 5,
						}}
					/>
				</div>

				{/* 游标坐标 */}
				<div className="view-field-group">
					<div className="view-field__label">
						<Move className="view-field__icon" />
						<span>游标位置</span>
					</div>
					<CursorCoordinateInput
						cursorX={mapCursor?.x ?? null}
						cursorY={mapCursor?.y ?? null}
						cursorR={cursorR ?? null}
						cameraX={cameraX}
						cameraY={cameraY}
						viewRotation={viewRotation}
						onCameraChange={onCameraChange}
						onSetMapCursor={onSetMapCursor}
						onClearMapCursor={onClearMapCursor}
						worldBounds={{
							minX: -10000,
							maxX: 10000,
							minY: -10000,
							maxY: 10000,
						}}
					/>
				</div>

				{/* 缩放信息 */}
				<div className="view-field-group">
					<div className="view-field__label">
						<ZoomIn className="view-field__icon" />
						<span>缩放级别</span>
					</div>
					<div className="view-field__row">
						<div className="view-field__value-display">
							<span className="view-field__value">{(zoom * 100).toFixed(0)}%</span>
						</div>
						<div className="view-field__buttons">
							<button
								data-magnetic
								className="view-field__control-btn"
								onClick={handleZoomOut}
								title="缩小"
							>
								<ZoomOut className="game-icon--sm" />
							</button>
							<button
								data-magnetic
								className="view-field__control-btn"
								onClick={handleZoomReset}
								title="重置缩放"
							>
								<Maximize className="game-icon--sm" />
							</button>
							<button
								data-magnetic
								className="view-field__control-btn"
								onClick={handleZoomIn}
								title="放大"
							>
								<ZoomIn className="game-icon--sm" />
							</button>
						</div>
					</div>
					<div className="view-field__slider-container">
						<input
							type="range"
							className="view-field__slider"
							min="0.1"
							max="5"
							step="0.1"
							value={zoom}
							onChange={(e) => onZoomChange(parseFloat(e.target.value))}
						/>
					</div>
				</div>

				{/* 旋转角度信息 */}
				<div className="view-field-group">
					<div className="view-field__label">
						<RotateCcw className="view-field__icon" />
						<span>视图旋转（已在坐标组件中控制）</span>
					</div>
					<div className="view-field__buttons view-field__buttons--spread">
						<button
							data-magnetic
							className="view-field__control-btn view-field__control-btn--labeled"
							onClick={handleRotateLeft}
							title="逆时针旋转 15°"
						>
							<RotateCcw className="game-icon--sm" />
							<span>-15°</span>
						</button>
						<button
							data-magnetic
							className="view-field__control-btn view-field__control-btn--labeled"
							onClick={handleRotateReset}
							title="重置旋转"
						>
							<Home className="game-icon--sm" />
							<span>归零</span>
						</button>
						<button
							data-magnetic
							className="view-field__control-btn view-field__control-btn--labeled"
							onClick={handleRotateRight}
							title="顺时针旋转 15°"
						>
							<RotateCw className="game-icon--sm" />
							<span>+15°</span>
						</button>
					</div>
				</div>
			</div>

			{/* 图层控制 */}
			<div className="view-section">
				<div className="view-section__title">
					<Grid3X3 className="view-section__icon" />
					<span>图层显示</span>
				</div>

				<div className="view-toggles">
					<label className="view-toggle">
						<input type="checkbox" checked={showGrid} onChange={onToggleGrid} />
						<span className="view-toggle__indicator" />
						<Grid3X3 className="view-toggle__icon" />
						<span className="view-toggle__label">网格</span>
					</label>

					<label className="view-toggle">
						<input type="checkbox" checked={showBackground} onChange={onToggleBackground} />
						<span className="view-toggle__indicator" />
						<Image className="view-toggle__icon" />
						<span className="view-toggle__label">背景</span>
					</label>

					<label className="view-toggle">
						<input type="checkbox" checked={showWeaponArcs} onChange={onToggleWeaponArcs} />
						<span className="view-toggle__indicator" />
						<Crosshair className="view-toggle__icon" />
						<span className="view-toggle__label">武器弧</span>
					</label>

					<label className="view-toggle">
						<input type="checkbox" checked={showMovementRange} onChange={onToggleMovementRange} />
						<span className="view-toggle__indicator" />
						<Navigation2 className="view-toggle__icon" />
						<span className="view-toggle__label">移动范围</span>
					</label>
				</div>
			</div>

			{/* 视图预设 */}
			<div className="view-section">
				<div className="view-section__title">
					<Monitor className="view-section__icon" />
					<span>视图预设</span>
				</div>
				<div className="view-presets">
					{viewPresets.map((preset) => (
						<button
							key={preset.name}
							data-magnetic
							className="view-preset-btn"
							onClick={() => applyPreset(preset)}
							title={`缩放：${preset.zoom * 100}%, 位置：(${preset.x}, ${preset.y}), 旋转：${preset.rotation}°`}
						>
							{preset.name}
						</button>
					))}
				</div>
			</div>

			{/* 视图操作 */}
			<div className="view-section">
				<div className="view-section__title">
					<Move className="view-section__icon" />
					<span>视图操作</span>
				</div>

				<div className="view-actions">
					<button data-magnetic className="view-action-btn" onClick={handleResetAll}>
						<RotateCcw className="game-icon--sm" />
						<span>重置视图</span>
					</button>
					<button data-magnetic className="view-action-btn" onClick={onResetView}>
						<Home className="game-icon--sm" />
						<span>返回原点</span>
					</button>
				</div>
			</div>

			{/* 快捷键提示 */}
			<div className="view-section view-section--hints">
				<div className="view-hints">
					<div className="view-hint">
						<span className="view-hint__key">滚轮</span>
						<span className="view-hint__desc">缩放视图</span>
					</div>
					<div className="view-hint">
						<span className="view-hint__key">拖拽</span>
						<span className="view-hint__desc">平移视图</span>
					</div>
					<div className="view-hint">
						<span className="view-hint__key">空格 + 拖拽</span>
						<span className="view-hint__desc">旋转视图</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ViewControlPanel;
