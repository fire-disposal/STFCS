/**
 * 象限选择器组件
 *
 * 显示目标舰船的护甲象限，支持：
 * - 6象限显示
 * - 护甲值可视化
 * - 象限选择
 */

import type { ArmorInstanceState, ArmorQuadrant } from "@vt/types";
import React from "react";

// 样式
const styles = {
	container: {
		display: "flex",
		flexDirection: "column" as const,
		gap: "12px",
	},
	header: {
		fontSize: "14px",
		fontWeight: "bold",
	},
	shipDiagram: {
		position: "relative" as const,
		width: "200px",
		height: "240px",
		margin: "0 auto",
	},
	quadrant: {
		position: "absolute" as const,
		cursor: "pointer",
		transition: "all 0.2s ease",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontSize: "11px",
		fontWeight: "bold",
		color: "white",
		textShadow: "0 1px 2px rgba(0,0,0,0.5)",
	},
	quadrantHover: {
		transform: "scale(1.05)",
		zIndex: 10,
	},
	quadrantSelected: {
		outline: "3px solid var(--color-primary)",
		outlineOffset: "2px",
	},
	info: {
		textAlign: "center" as const,
		fontSize: "12px",
		color: "var(--color-text-secondary)",
	},
	legend: {
		display: "flex",
		justifyContent: "center",
		gap: "16px",
		marginTop: "8px",
		fontSize: "11px",
	},
	legendItem: {
		display: "flex",
		alignItems: "center",
		gap: "4px",
	},
	legendColor: {
		width: "12px",
		height: "12px",
		borderRadius: "0",
	},
};

// 象限位置配置
const quadrantPositions: Record<
	ArmorQuadrant,
	{
		top: string;
		left: string;
		width: string;
		height: string;
		clipPath: string;
	}
> = {
	FRONT_TOP: {
		top: "0",
		left: "50px",
		width: "100px",
		height: "80px",
		clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
	},
	FRONT_BOTTOM: {
		top: "60px",
		left: "50px",
		width: "100px",
		height: "60px",
		clipPath: "polygon(0% 0%, 100% 0%, 80% 100%, 20% 100%)",
	},
	LEFT_TOP: {
		top: "20px",
		left: "0",
		width: "60px",
		height: "80px",
		clipPath: "polygon(100% 0%, 100% 100%, 0% 70%, 0% 30%)",
	},
	LEFT_BOTTOM: {
		top: "80px",
		left: "0",
		width: "60px",
		height: "80px",
		clipPath: "polygon(100% 0%, 80% 100%, 0% 100%, 0% 0%)",
	},
	RIGHT_TOP: {
		top: "20px",
		left: "140px",
		width: "60px",
		height: "80px",
		clipPath: "polygon(0% 0%, 100% 30%, 100% 70%, 0% 100%)",
	},
	RIGHT_BOTTOM: {
		top: "80px",
		left: "140px",
		width: "60px",
		height: "80px",
		clipPath: "polygon(20% 0%, 100% 0%, 100% 100%, 0% 100%)",
	},
};

// 象限名称
const quadrantNames: Record<ArmorQuadrant, string> = {
	FRONT_TOP: "前上",
	FRONT_BOTTOM: "前下",
	LEFT_TOP: "左上",
	LEFT_BOTTOM: "左下",
	RIGHT_TOP: "右上",
	RIGHT_BOTTOM: "右下",
};

interface QuadrantSelectorProps {
	armor: ArmorInstanceState;
	selectedQuadrant?: ArmorQuadrant;
	onSelect: (quadrant: ArmorQuadrant) => void;
	showValues?: boolean;
}

export const QuadrantSelector: React.FC<QuadrantSelectorProps> = ({
	armor,
	selectedQuadrant,
	onSelect,
	showValues = true,
}) => {
	const [hoveredQuadrant, setHoveredQuadrant] = React.useState<ArmorQuadrant | null>(null);

	// 获取护甲颜色
	const getArmorColor = (value: number, max: number): string => {
		const percent = value / max;
		if (percent > 0.75) return "#2ecc71"; // 绿色
		if (percent > 0.5) return "#f1c40f"; // 黄色
		if (percent > 0.25) return "#e67e22"; // 橙色
		return "#e74c3c"; // 红色
	};

	// 处理象限点击
	const handleQuadrantClick = (quadrant: ArmorQuadrant) => {
		onSelect(quadrant);
	};

	return (
		<div style={styles.container}>
			<div style={styles.header}>选择攻击象限</div>

			{/* 舰船象限图 */}
			<div style={styles.shipDiagram}>
				{Object.entries(quadrantPositions).map(([quadrant, position]) => {
					const q = quadrant as ArmorQuadrant;
					const value = armor.quadrants[q];
					const max = armor.maxPerQuadrant;
					const percent = Math.round((value / max) * 100);
					const isHovered = hoveredQuadrant === q;
					const isSelected = selectedQuadrant === q;

					return (
						<div
							key={quadrant}
							style={{
								...styles.quadrant,
								...position,
								backgroundColor: getArmorColor(value, max),
								...(isHovered ? styles.quadrantHover : {}),
								...(isSelected ? styles.quadrantSelected : {}),
							}}
							onClick={() => handleQuadrantClick(q)}
							onMouseEnter={() => setHoveredQuadrant(q)}
							onMouseLeave={() => setHoveredQuadrant(null)}
						>
							{showValues ? (
								<div style={{ textAlign: "center" }}>
									<div>{quadrantNames[q]}</div>
									<div style={{ fontSize: "10px" }}>{percent}%</div>
								</div>
							) : (
								quadrantNames[q]
							)}
						</div>
					);
				})}

				{/* 舰船中心指示 */}
				<div
					style={{
						position: "absolute",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						width: "40px",
						height: "60px",
						backgroundColor: "var(--color-surface-dark)",
						borderRadius: "0",
						pointerEvents: "none",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: "20px",
					}}
				>
					🚀
				</div>
			</div>

			{/* 提示信息 */}
			<div style={styles.info}>
				{hoveredQuadrant ? (
					<span>
						{quadrantNames[hoveredQuadrant]}: {armor.quadrants[hoveredQuadrant]} /{" "}
						{armor.maxPerQuadrant}
					</span>
				) : (
					<span>点击选择要攻击的象限</span>
				)}
			</div>

			{/* 图例 */}
			<div style={styles.legend}>
				<div style={styles.legendItem}>
					<div style={{ ...styles.legendColor, backgroundColor: "#2ecc71" }} />
					<span>&gt;75%</span>
				</div>
				<div style={styles.legendItem}>
					<div style={{ ...styles.legendColor, backgroundColor: "#f1c40f" }} />
					<span>50-75%</span>
				</div>
				<div style={styles.legendItem}>
					<div style={{ ...styles.legendColor, backgroundColor: "#e67e22" }} />
					<span>25-50%</span>
				</div>
				<div style={styles.legendItem}>
					<div style={{ ...styles.legendColor, backgroundColor: "#e74c3c" }} />
					<span>&lt;25%</span>
				</div>
			</div>
		</div>
	);
};

export default QuadrantSelector;
