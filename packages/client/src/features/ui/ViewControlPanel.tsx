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

import {
	Check,
	Copy,
	Crosshair,
	Grid3X3,
	Home,
	Image,
	Maximize,
	Monitor,
	Move,
	Navigation2,
	RotateCcnw,
	RotateCcw,
	RotateCw,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import React, { useState } from "react";

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
}) => {
	const [inputX, setInputX] = useState<string>("");
	const [inputY, setInputY] = useState<string>("");
	const [inputRotation, setInputRotation] = useState<string>("");
	const [copiedField, setCopiedField] = useState<string | null>(null);

	// 处理坐标跳转
	const handleJumpToPosition = () => {
		const x = parseFloat(inputX);
		const y = parseFloat(inputY);
		if (!isNaN(x) && !isNaN(y)) {
			onCameraChange(x, y);
		}
	};

	// 处理旋转角度设置
	const handleSetRotation = () => {
		const rotation = parseFloat(inputRotation);
		if (!isNaN(rotation)) {
			onViewRotationChange(rotation % 360);
		}
	};

	// 复制坐标到剪贴板
	const copyToClipboard = async (text: string, field: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedField(field);
			setTimeout(() => setCopiedField(null), 2000);
		} catch (err) {
			console.error("复制失败:", err);
		}
	};

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

	return (
		<div className="view-control-panel">
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
					<div className="view-field__row">
						<div className="view-field__input-group">
							<span className="view-field__prefix">X:</span>
							<input
								type="number"
								className="view-field__input"
								value={inputX || cameraX.toFixed(1)}
								onChange={(e) => setInputX(e.target.value)}
								onBlur={() => setInputX("")}
								onFocus={(e) => e.target.select()}
								step="10"
							/>
							<button
								data-magnetic
								className="view-field__copy-btn"
								onClick={() => copyToClipboard(cameraX.toFixed(1), "x")}
								title="复制 X 坐标"
							>
								{copiedField === "x" ? (
									<Check className="game-icon--xs" />
								) : (
									<Copy className="game-icon--xs" />
								)}
							</button>
						</div>
						<div className="view-field__input-group">
							<span className="view-field__prefix">Y:</span>
							<input
								type="number"
								className="view-field__input"
								value={inputY || cameraY.toFixed(1)}
								onChange={(e) => setInputY(e.target.value)}
								onBlur={() => setInputY("")}
								onFocus={(e) => e.target.select()}
								step="10"
							/>
							<button
								data-magnetic
								className="view-field__copy-btn"
								onClick={() => copyToClipboard(cameraY.toFixed(1), "y")}
								title="复制 Y 坐标"
							>
								{copiedField === "y" ? (
									<Check className="game-icon--xs" />
								) : (
									<Copy className="game-icon--xs" />
								)}
							</button>
						</div>
						<button
							data-magnetic
							className="view-field__action-btn"
							onClick={handleJumpToPosition}
							disabled={!inputX && !inputY}
						>
							<Move className="game-icon--xs" />
							<span>跳转</span>
						</button>
					</div>
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
								<Maximize className="game-icon--sm" />
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
						<span>视图旋转</span>
					</div>
					<div className="view-field__row">
						<div className="view-field__value-display">
							<span className="view-field__value">{viewRotation.toFixed(1)}°</span>
						</div>
						<div className="view-field__input-group">
							<input
								type="number"
								className="view-field__input view-field__input--small"
								value={inputRotation || ""}
								onChange={(e) => setInputRotation(e.target.value)}
								onBlur={() => setInputRotation("")}
								onFocus={(e) => e.target.select()}
								placeholder="角度"
								step="15"
							/>
							<button
								data-magnetic
								className="view-field__action-btn view-field__action-btn--small"
								onClick={handleSetRotation}
								disabled={!inputRotation}
							>
								<span>设置</span>
							</button>
						</div>
					</div>
					<div className="view-field__buttons view-field__buttons--spread">
						<button
							data-magnetic
							className="view-field__control-btn view-field__control-btn--labeled"
							onClick={handleRotateLeft}
							title="逆时针旋转 15°"
						>
							<RotateCcnw className="game-icon--sm" />
							<Home className="game-icon--sm" />
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
