import type { UseCameraAnimationResult } from "@/renderer";
import { useUIStore } from "@/state/stores/uiStore";
import React from "react";
import { CursorCoordinateInput } from "./CursorCoordinateInput";
import { CoordinateInput } from "@/ui/shared/CoordinateInput";
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
	Sparkles,
	Tag,
	ZoomIn,
	ZoomOut,
	Shield,
} from "lucide-react";

interface ViewControlPanelProps {
	cameraAnimation?: UseCameraAnimationResult;
	onResetView: () => void;
}

export const ViewControlPanel: React.FC<ViewControlPanelProps> = ({
	cameraAnimation,
	onResetView,
}) => {
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
		mapCursor,
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
		setMapCursor,
		clearMapCursor,
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

	const viewPresets = [
		{ name: "全局", zoom: 0.5, x: 0, y: 0, rotation: 0 },
		{ name: "标准", zoom: 1, x: 0, y: 0, rotation: 0 },
		{ name: "局部", zoom: 2, x: 0, y: 0, rotation: 0 },
		{ name: "细节", zoom: 3, x: 0, y: 0, rotation: 0 },
	];

	const applyPreset = (preset: typeof viewPresets[0]) => {
		setZoom(preset.zoom);
		setCameraPosition(preset.x, preset.y);
		setViewRotation(preset.rotation);
	};

	return (
		<div className="view-control-panel">
			<div className="view-status-bar">
				<div className="view-status-item">
					<span className="view-status-label">坐标</span>
					<span className="view-status-value">
						({Math.round(cameraPosition.x)}, {Math.round(cameraPosition.y)})
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

			<div className="view-section">
				<div className="view-section__title">
					<Monitor className="view-section__icon" />
					<span>视图信息</span>
				</div>

				<div className="view-field-group">
					<div className="view-field__label">
						<Navigation2 className="view-field__icon" />
						<span>相机坐标</span>
					</div>
					<CoordinateInput
						cameraX={cameraPosition.x}
						cameraY={cameraPosition.y}
						viewRotation={viewRotation}
						zoom={zoom}
						onCameraChange={setCameraPosition}
						onViewRotationChange={setViewRotation}
						onZoomChange={setZoom}
						animateToCoords={cameraAnimation?.animateToCoords}
						worldBounds={{
							minX: -10000,
							maxX: 10000,
							minY: -10000,
							maxY: 10000,
							minZoom: 0.5,
							maxZoom: 5,
						}}
					/>
				</div>

				<div className="view-field-group">
					<div className="view-field__label">
						<Move className="view-field__icon" />
						<span>游标位置</span>
					</div>
					<CursorCoordinateInput
						cursorX={mapCursor?.x ?? null}
						cursorY={mapCursor?.y ?? null}
						cursorR={mapCursor?.r ?? null}
						cameraX={cameraPosition.x}
						cameraY={cameraPosition.y}
						viewRotation={viewRotation}
						onCameraChange={setCameraPosition}
						onSetMapCursor={setMapCursor}
						onClearMapCursor={clearMapCursor}
						worldBounds={{
							minX: -10000,
							maxX: 10000,
							minY: -10000,
							maxY: 10000,
						}}
					/>
				</div>

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
							min="0.5"
							max="5"
							step="0.1"
							value={zoom}
							onChange={(e) => setZoom(parseFloat(e.target.value))}
						/>
					</div>
				</div>

				<div className="view-field-group">
					<div className="view-field__label">
						<RotateCcw className="view-field__icon" />
						<span>视图旋转</span>
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

			<div className="view-section">
				<div className="view-section__title">
					<Grid3X3 className="view-section__icon" />
					<span>图层显示</span>
				</div>

				<div className="view-toggles">
					<label className="view-toggle">
						<input type="checkbox" checked={showGrid} onChange={toggleGrid} />
						<span className="view-toggle__indicator" />
						<Grid3X3 className="view-toggle__icon" />
						<span className="view-toggle__label">网格</span>
					</label>

					<label className="view-toggle">
						<input type="checkbox" checked={showBackground} onChange={toggleBackground} />
						<span className="view-toggle__indicator" />
						<Image className="view-toggle__icon" />
						<span className="view-toggle__label">背景</span>
					</label>

					<label className="view-toggle">
						<input type="checkbox" checked={showWeaponArcs} onChange={toggleWeaponArcs} />
						<span className="view-toggle__indicator" />
						<Crosshair className="view-toggle__icon" />
						<span className="view-toggle__label">武器弧</span>
					</label>

					<label className="view-toggle">
						<input type="checkbox" checked={showMovementRange} onChange={toggleMovementRange} />
						<span className="view-toggle__indicator" />
						<Navigation2 className="view-toggle__icon" />
						<span className="view-toggle__label">移动范围</span>
					</label>

					<label className="view-toggle">
						<input type="checkbox" checked={showLabels} onChange={toggleLabels} />
						<span className="view-toggle__indicator" />
						<Tag className="view-toggle__icon" />
						<span className="view-toggle__label">标签</span>
					</label>

					<label className="view-toggle">
						<input type="checkbox" checked={showEffects} onChange={toggleEffects} />
						<span className="view-toggle__indicator" />
						<Sparkles className="view-toggle__icon" />
						<span className="view-toggle__label">特效</span>
					</label>

					<label className="view-toggle">
						<input type="checkbox" checked={showShipIcons} onChange={toggleShipIcons} />
						<span className="view-toggle__indicator" />
						<Monitor className="view-toggle__icon" />
						<span className="view-toggle__label">图标</span>
					</label>

					<label className="view-toggle">
						<input type="checkbox" checked={showHexagonArmor} onChange={toggleHexagonArmor} />
						<span className="view-toggle__indicator" />
						<Shield className="view-toggle__icon" />
						<span className="view-toggle__label">护甲</span>
					</label>
				</div>
			</div>

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