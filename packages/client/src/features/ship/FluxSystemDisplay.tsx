/**
 * 辐能系统显示组件
 *
 * 显示软/硬辐能、容量、消散率等详细信息
 */

import type { ShipState } from "@vt/types";
import React from "react";

const styles = {
	container: {
		padding: "12px",
		backgroundColor: "rgba(10, 30, 50, 0.8)",
		borderRadius: "0",
		border: "1px solid #2b4261",
	},
	header: {
		fontSize: "11px",
		fontWeight: "bold",
		color: "#4a9eff",
		marginBottom: "8px",
		display: "flex",
		alignItems: "center",
		gap: "6px",
	},
	grid: {
		display: "grid",
		gridTemplateColumns: "1fr 1fr",
		gap: "8px",
		marginBottom: "10px",
	},
	statBox: {
		padding: "6px",
		backgroundColor: "rgba(6, 16, 26, 0.6)",
		borderRadius: "0",
	},
	statLabel: {
		fontSize: "9px",
		color: "#8ba4c7",
		marginBottom: "3px",
	},
	statValue: {
		fontSize: "12px",
		fontWeight: "bold",
		color: "#cfe8ff",
	},
	barContainer: {
		height: "16px",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		borderRadius: "0",
		overflow: "hidden",
		position: "relative" as const,
		marginBottom: "4px",
	},
	barFill: {
		height: "100%",
		borderRadius: "0",
		transition: "width 0.3s ease",
	},
	barText: {
		position: "absolute" as const,
		top: "50%",
		left: "50%",
		transform: "translate(-50%, -50%)",
		fontSize: "9px",
		fontWeight: "bold",
		color: "#ffffff",
		textShadow: "0 0 2px #000000",
	},
	ventButton: {
		width: "100%",
		padding: "8px",
		borderRadius: "0",
		border: "1px solid #4a9eff",
		backgroundColor: "#1a4a7a",
		color: "#4a9eff",
		fontSize: "11px",
		fontWeight: "bold",
		cursor: "pointer",
		transition: "all 0.2s",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: "6px",
	},
	ventButtonDisabled: {
		opacity: 0.5,
		cursor: "not-allowed",
		backgroundColor: "#2b4261",
		borderColor: "#5a6a7a",
		color: "#5a6a7a",
	},
	overloadWarning: {
		padding: "8px",
		borderRadius: "0",
		backgroundColor: "rgba(255, 74, 74, 0.2)",
		border: "1px solid #ff4a4a",
		color: "#ff6f8f",
		fontSize: "10px",
		textAlign: "center" as const,
		marginBottom: "8px",
	},
	hint: {
		fontSize: "9px",
		color: "#6b7280",
		marginTop: "6px",
		fontStyle: "italic",
	},
};

interface FluxSystemDisplayProps {
	ship: ShipState | null;
	onVentFlux?: () => void;
	canVent?: boolean;
	currentPhase?: string;
}

export const FluxSystemDisplay: React.FC<FluxSystemDisplayProps> = ({
	ship,
	onVentFlux,
	canVent = false,
	currentPhase = "PLAYER_TURN",
}) => {
	if (!ship) {
		return (
			<div style={styles.container}>
				<div style={styles.header}>⚡ 辐能系统</div>
				<div style={{ color: "#8ba4c7", fontSize: "10px", textAlign: "center" }}>未选择舰船</div>
			</div>
		);
	}

	const totalFlux = ship.fluxHard + ship.fluxSoft;
	const fluxPercent = Math.min(100, (totalFlux / ship.fluxMax) * 100);
	const softFluxPercent = (ship.fluxSoft / ship.fluxMax) * 100;
	const hardFluxPercent = (ship.fluxHard / ship.fluxMax) * 100;
	const isOverloaded = ship.isOverloaded;
	const isShieldUp = ship.isShieldUp;

	// 计算下回合自然消散后的软辐能
	const nextTurnSoftFlux = Math.max(0, ship.fluxSoft - ship.fluxDissipation);
	const nextTurnTotal = nextTurnSoftFlux + ship.fluxHard;
	const willBeOverloaded = nextTurnTotal >= ship.fluxMax;

	return (
		<div style={styles.container}>
			<div style={styles.header}>⚡ 辐能系统</div>

			{/* 过载警告 */}
			{isOverloaded && (
				<div style={styles.overloadWarning}>
					⚠️ 舰船过载！无法移动、开火或使用护盾
					{ship.overloadTime > 0 && ` - 剩余 ${ship.overloadTime.toFixed(1)}s`}
				</div>
			)}

			{/* 总辐能条 */}
			<div style={{ marginBottom: "10px" }}>
				<div style={styles.statLabel}>
					总辐能 {totalFlux.toFixed(0)} / {ship.fluxMax}
				</div>
				<div style={styles.barContainer}>
					<div
						style={{
							...styles.barFill,
							width: `${fluxPercent}%`,
							backgroundColor: isOverloaded ? "#ff4a4a" : fluxPercent > 80 ? "#ffa500" : "#4a9eff",
						}}
					/>
					<div style={styles.barText}>{fluxPercent.toFixed(0)}%</div>
				</div>
			</div>

			{/* 软/硬辐能分离显示 */}
			<div style={styles.grid}>
				{/* 软辐能 */}
				<div style={styles.statBox}>
					<div style={styles.statLabel}>软辐能</div>
					<div style={styles.statValue}>{ship.fluxSoft.toFixed(0)}</div>
					<div style={{ ...styles.barContainer, height: "10px", marginTop: "4px" }}>
						<div
							style={{
								...styles.barFill,
								width: `${softFluxPercent}%`,
								backgroundColor: "#4a9eff",
							}}
						/>
					</div>
					<div style={styles.hint}>下回合：{nextTurnSoftFlux.toFixed(0)}</div>
				</div>

				{/* 硬辐能 */}
				<div style={styles.statBox}>
					<div style={styles.statLabel}>硬辐能</div>
					<div style={styles.statValue}>{ship.fluxHard.toFixed(0)}</div>
					<div style={{ ...styles.barContainer, height: "10px", marginTop: "4px" }}>
						<div
							style={{
								...styles.barFill,
								width: `${hardFluxPercent}%`,
								backgroundColor: "#ff6f8f",
							}}
						/>
					</div>
					<div style={styles.hint}>需关闭护盾排散</div>
				</div>
			</div>

			{/* 辐能消散率 */}
			<div style={styles.grid}>
				<div style={styles.statBox}>
					<div style={styles.statLabel}>辐能消散</div>
					<div style={styles.statValue}>{ship.fluxDissipation}/回合</div>
				</div>
				<div style={styles.statBox}>
					<div style={styles.statLabel}>护盾状态</div>
					<div
						style={{
							...styles.statValue,
							color: isShieldUp ? "#3ddb6f" : "#8ba4c7",
						}}
					>
						{isShieldUp ? "开启" : "关闭"}
					</div>
				</div>
			</div>

			{/* 过载预警 */}
			{!isOverloaded && willBeOverloaded && (
				<div
					style={{
						...styles.overloadWarning,
						backgroundColor: "rgba(255, 165, 0, 0.2)",
						borderColor: "#ffa500",
						color: "#ffa500",
					}}
				>
					⚠️ 下回合可能过载！建议主动排散
				</div>
			)}

			{/* 主动排散按钮 */}
			{onVentFlux && (
				<button
					style={{
						...styles.ventButton,
						...(!canVent || isOverloaded ? styles.ventButtonDisabled : {}),
					}}
					onClick={onVentFlux}
					disabled={!canVent || isOverloaded}
				>
					💨 主动排散辐能
				</button>
			)}

			{/* 提示信息 */}
			<div style={styles.hint}>
				{isOverloaded
					? "过载状态下无法排散，需等待下回合自动恢复"
					: canVent
						? "排散后本回合无法移动、开火或使用护盾"
						: "开火后本回合无法排散"}
			</div>
		</div>
	);
};

export default FluxSystemDisplay;
