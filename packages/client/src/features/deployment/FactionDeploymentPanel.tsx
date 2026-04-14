/**
 * 阵营部署面板组件
 *
 * 显示阵营部署状态和控制：
 * - 已部署舰船列表
 * - 部署点数统计
 * - 就绪按钮
 */

import type { FactionId, ShipTokenV2 } from "@vt/types";
import React from "react";

// 样式
const styles = {
	container: {
		borderTop: "1px solid var(--color-border)",
		padding: "16px",
		backgroundColor: "var(--color-background)",
	},
	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: "12px",
	},
	title: {
		fontSize: "14px",
		fontWeight: "bold",
	},
	points: {
		fontSize: "13px",
		color: "var(--color-text-secondary)",
	},
	shipList: {
		maxHeight: "150px",
		overflow: "auto",
		marginBottom: "12px",
	},
	shipItem: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "8px",
		marginBottom: "4px",
		backgroundColor: "var(--color-surface)",
		borderRadius: "0",
		fontSize: "13px",
	},
	shipName: {
		flex: 1,
	},
	shipCost: {
		color: "var(--color-primary)",
		fontWeight: "bold",
	},
	removeButton: {
		padding: "2px 8px",
		marginLeft: "8px",
		backgroundColor: "var(--color-error-light)",
		border: "none",
		borderRadius: "0",
		cursor: "pointer",
		fontSize: "11px",
		color: "var(--color-error)",
	},
	emptyState: {
		padding: "16px",
		textAlign: "center" as const,
		color: "var(--color-text-secondary)",
		fontSize: "13px",
	},
	readyButton: {
		width: "100%",
		padding: "12px",
		borderRadius: "0",
		border: "none",
		cursor: "pointer",
		fontSize: "14px",
		fontWeight: "bold",
		transition: "all 0.2s ease",
	},
	readyButtonActive: {
		backgroundColor: "var(--color-success)",
		color: "white",
	},
	readyButtonInactive: {
		backgroundColor: "var(--color-primary)",
		color: "white",
	},
	summary: {
		display: "flex",
		justifyContent: "space-between",
		padding: "8px 0",
		borderTop: "1px solid var(--color-border)",
		marginTop: "8px",
		fontSize: "13px",
	},
};

interface FactionDeploymentPanelProps {
	faction: FactionId | null;
	isReady: boolean;
	onReadyToggle: () => void;
	deployedShips?: ShipTokenV2[];
	maxDeploymentPoints?: number;
	onRemoveShip?: (tokenId: string) => void;
}

export const FactionDeploymentPanel: React.FC<FactionDeploymentPanelProps> = ({
	faction,
	isReady,
	onReadyToggle,
	deployedShips = [],
	maxDeploymentPoints = 100,
	onRemoveShip,
}) => {
	// 计算已使用的部署点数
	const usedPoints = deployedShips.reduce((sum, ship) => {
		// 这里应该从舰船定义获取部署点数
		// 暂时使用固定值
		return sum + 10;
	}, 0);

	const remainingPoints = maxDeploymentPoints - usedPoints;

	if (!faction) {
		return (
			<div style={styles.container}>
				<div style={styles.emptyState}>请先选择阵营</div>
			</div>
		);
	}

	return (
		<div style={styles.container}>
			{/* 标题和部署点数 */}
			<div style={styles.header}>
				<span style={styles.title}>已部署舰船</span>
				<span style={styles.points}>
					{usedPoints} / {maxDeploymentPoints} DP
				</span>
			</div>

			{/* 舰船列表 */}
			<div style={styles.shipList}>
				{deployedShips.length === 0 ? (
					<div style={styles.emptyState}>尚未部署舰船</div>
				) : (
					deployedShips.map((ship) => (
						<div key={ship.id} style={styles.shipItem}>
							<span style={styles.shipName}>{ship.shipName ?? "未命名舰船"}</span>
							<span style={styles.shipCost}>10 DP</span>
							{onRemoveShip && (
								<button style={styles.removeButton} onClick={() => onRemoveShip(ship.id)}>
									移除
								</button>
							)}
						</div>
					))
				)}
			</div>

			{/* 统计摘要 */}
			<div style={styles.summary}>
				<span>舰船数量: {deployedShips.length}</span>
				<span>剩余 DP: {remainingPoints}</span>
			</div>

			{/* 就绪按钮 */}
			<button
				style={{
					...styles.readyButton,
					...(isReady ? styles.readyButtonActive : styles.readyButtonInactive),
				}}
				onClick={onReadyToggle}
			>
				{isReady ? "取消就绪" : "准备就绪"}
			</button>
		</div>
	);
};

export default FactionDeploymentPanel;
