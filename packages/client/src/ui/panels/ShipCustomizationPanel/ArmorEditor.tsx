/**
 * ArmorEditor - 六象限护甲可视化编辑器
 *
 * 可视化展示和编辑舰船的六象限护甲值：
 * - 六边形布局，每个象限可单独编辑
 * - 颜色编码：绿色(高)、黄色(中)、橙色(低)、红色(危险)
 * - 点击象限弹出数值编辑
 * - 支持批量操作（重置全部、全部设置）
 */

import React, { useState, useCallback, useMemo } from "react";
import { RotateCcw, Layers } from "lucide-react";

// 象限定义（与ArmorQuadrant对应）
const QUADRANT_CONFIG = [
	{ id: 0, name: "前上", angle: 0 },      // FRONT_TOP
	{ id: 1, name: "前下", angle: 60 },     // FRONT_BOTTOM  
	{ id: 2, name: "左上", angle: 120 },    // LEFT_TOP
	{ id: 3, name: "左下", angle: 180 },    // LEFT_BOTTOM
	{ id: 4, name: "右上", angle: 240 },    // RIGHT_TOP
	{ id: 5, name: "右下", angle: 300 },    // RIGHT_BOTTOM
];

// 护甲状态颜色阈值
const ARMOR_THRESHOLDS = {
	high: 80,    // 80-100% 绿色
	medium: 50,  // 50-80% 黄色
	low: 20,     // 20-50% 橙色
	critical: 0, // 0-20% 红色
};

interface ArmorEditorProps {
	/** 六象限护甲值 */
	quadrants: [number, number, number, number, number, number];
	/** 单象限护甲上限 */
	maxPerQuadrant: number;
	/** 值变更回调 */
	onChange: (quadrants: [number, number, number, number, number, number]) => void;
	/** 禁用状态 */
	disabled?: boolean;
}

export const ArmorEditor: React.FC<ArmorEditorProps> = ({
	quadrants,
	maxPerQuadrant,
	onChange,
	disabled = false,
}) => {
	// 当前编辑的象限
	const [editingQuadrant, setEditingQuadrant] = useState<number | null>(null);
	// 编辑值
	const [editValue, setEditValue] = useState<number>(0);

	// 获取象限颜色类
	const getQuadrantColorClass = useCallback((value: number) => {
		const percent = (value / maxPerQuadrant) * 100;
		if (percent >= ARMOR_THRESHOLDS.high) return "high";
		if (percent >= ARMOR_THRESHOLDS.medium) return "medium";
		if (percent >= ARMOR_THRESHOLDS.low) return "low";
		return "critical";
	}, [maxPerQuadrant]);

	// 获取象限颜色
	const getQuadrantColor = useCallback((value: number) => {
		const percent = (value / maxPerQuadrant) * 100;
		if (percent >= ARMOR_THRESHOLDS.high) return "#2ecc71";
		if (percent >= ARMOR_THRESHOLDS.medium) return "#f1c40f";
		if (percent >= ARMOR_THRESHOLDS.low) return "#e67e22";
		return "#e74c3c";
	}, [maxPerQuadrant]);

	// 点击象限开始编辑
	const handleQuadrantClick = useCallback((index: number) => {
		if (disabled) return;
		setEditingQuadrant(index);
		setEditValue(quadrants[index]);
	}, [disabled, quadrants]);

	// 确认编辑值
	const handleEditConfirm = useCallback(() => {
		if (editingQuadrant === null) return;
		const newQuadrants = [...quadrants] as [number, number, number, number, number, number];
		newQuadrants[editingQuadrant] = Math.max(0, Math.min(maxPerQuadrant, editValue));
		onChange(newQuadrants);
		setEditingQuadrant(null);
	}, [editingQuadrant, editValue, quadrants, maxPerQuadrant, onChange]);

	// 取消编辑
	const handleEditCancel = useCallback(() => {
		setEditingQuadrant(null);
	}, []);

	// 重置全部护甲
	const handleResetAll = useCallback(() => {
		if (disabled) return;
		onChange([maxPerQuadrant, maxPerQuadrant, maxPerQuadrant, maxPerQuadrant, maxPerQuadrant, maxPerQuadrant]);
	}, [disabled, maxPerQuadrant, onChange]);

	// 全部设置指定值
	const handleSetAll = useCallback(() => {
		if (disabled) return;
		// 弹出输入框让用户输入值
		const value = prompt(`设置全部护甲值 (0-${maxPerQuadrant}):`, String(maxPerQuadrant));
		if (value === null) return;
		const numValue = Math.max(0, Math.min(maxPerQuadrant, Number(value)));
		onChange([numValue, numValue, numValue, numValue, numValue, numValue]);
	}, [disabled, maxPerQuadrant, onChange]);

	// SVG六边形路径计算
	const hexagonPath = useMemo(() => {
		const size = 50; // 六边形半径
		const cx = 60;   // 中心X
		const cy = 60;   // 中心Y

		// 六个顶点坐标
		const vertices: { x: number; y: number }[] = [];
		for (let i = 0; i < 6; i++) {
			const angle = (i * 60 - 90) * (Math.PI / 180); // 从顶部开始
			vertices.push({
				x: cx + size * Math.cos(angle),
				y: cy + size * Math.sin(angle),
			});
		}

		// 六个象限（每个象限是一个三角形，由中心和两个相邻顶点组成）
		const quadrantPaths = QUADRANT_CONFIG.map((q, i) => {
			const v1 = vertices[i];
			const v2 = vertices[(i + 1) % 6];
			return `M ${cx} ${cy} L ${v1.x} ${v1.y} L ${v2.x} ${v2.y} Z`;
		});

		return quadrantPaths;
	}, []);

	return (
		<div className="ship-customization-armor-editor">
			{/* 标题和快捷操作 */}
			<div className="ship-customization-armor-editor__header">
				<span className="ship-customization-armor-editor__title">六象限护甲</span>
				<div className="ship-customization-armor-editor__actions">
					<button
						className="ship-customization-armor-editor__action"
						onClick={handleResetAll}
						disabled={disabled}
						title="重置全部"
					>
						<RotateCcw className="ship-customization-armor-editor__action-icon" />
					</button>
					<button
						className="ship-customization-armor-editor__action"
						onClick={handleSetAll}
						disabled={disabled}
						title="全部设置"
					>
						<Layers className="ship-customization-armor-editor__action-icon" />
					</button>
				</div>
			</div>

			{/* SVG六边形可视化 */}
			<div className="ship-customization-armor-hexagon">
				<svg width="120" height="120" viewBox="0 0 120 120">
					{/* 六个象限 */}
					{hexagonPath.map((path, index) => (
						<path
							key={index}
							d={path}
							className={`ship-customization-armor-quadrant ship-customization-armor-quadrant--${getQuadrantColorClass(quadrants[index])}`}
							onClick={() => handleQuadrantClick(index)}
							style={{
								stroke: "#1a2d42",
								strokeWidth: 1,
								cursor: disabled ? "default" : "pointer",
							}}
						/>
					))}
					{/* 中心点标记 */}
					<circle cx="60" cy="60" r="4" fill="#ff6f8f" />
					{/* 船头指示 */}
					<text x="60" y="8" textAnchor="middle" fontSize="8" fill="#8ba4c7">船头</text>
					{/* 船尾指示 */}
					<text x="60" y="115" textAnchor="middle" fontSize="8" fill="#8ba4c7">船尾</text>
				</svg>

				{/* 象限数值标签 */}
				{QUADRANT_CONFIG.map((q, index) => {
					// 计算标签位置（象限中心）
					const angle = (q.angle - 30) * (Math.PI / 180);
					const labelRadius = 35;
					const lx = 60 + labelRadius * Math.cos(angle);
					const ly = 60 + labelRadius * Math.sin(angle);

					return (
						<div
							key={index}
							className="ship-customization-armor-quadrant__label"
							style={{
								left: `${lx}px`,
								top: `${ly}px`,
								transform: "translate(-50%, -50%)",
								position: "absolute",
							}}
						>
							{quadrants[index]}
						</div>
					);
				})}
			</div>

			{/* 象限详情列表 */}
			<div className="ship-customization-armor-editor__list">
				{QUADRANT_CONFIG.map((q, index) => (
					<div
						key={index}
						className="ship-customization-armor-editor__item"
						onClick={() => handleQuadrantClick(index)}
						style={{ cursor: disabled ? "default" : "pointer" }}
					>
						<span
							className="ship-customization-armor-editor__item-indicator"
							style={{ backgroundColor: getQuadrantColor(quadrants[index]) }}
						/>
						<span className="ship-customization-armor-editor__item-name">{q.name}</span>
						<span className="ship-customization-armor-editor__item-value">
							{quadrants[index]}/{maxPerQuadrant}
						</span>
						<span className="ship-customization-armor-editor__item-percent">
							{Math.round((quadrants[index] / maxPerQuadrant) * 100)}%
						</span>
					</div>
				))}
			</div>

			{/* 编辑弹窗 */}
			{editingQuadrant !== null && (
				<div className="ship-customization-armor-editor__modal">
					<div className="ship-customization-armor-editor__modal-content">
						<div className="ship-customization-armor-editor__modal-title">
							编辑 {QUADRANT_CONFIG[editingQuadrant].name} 象限护甲
						</div>
						<div className="ship-customization-armor-editor__modal-input">
							<input
								type="number"
								value={editValue}
								onChange={(e) => setEditValue(Number(e.target.value))}
								min={0}
								max={maxPerQuadrant}
								className="ship-customization-field__input"
								style={{ width: "100%" }}
							/>
							<span className="ship-customization-armor-editor__modal-range">
								范围: 0 - {maxPerQuadrant}
							</span>
						</div>
						<div className="ship-customization-armor-editor__modal-actions">
							<button
								className="ship-customization-panel__button ship-customization-panel__button--primary"
								onClick={handleEditConfirm}
							>
								确认
							</button>
							<button
								className="ship-customization-panel__button ship-customization-panel__button--secondary"
								onClick={handleEditCancel}
							>
								取消
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default ArmorEditor;