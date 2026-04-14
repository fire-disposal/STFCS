/**
 * 移动阶段指示器组件
 *
 * 显示当前移动阶段状态的简洁指示器
 */

import type { MovementPhase } from "@vt/types";
import React from "react";

// 样式
const styles = {
	container: {
		display: "flex",
		alignItems: "center",
		gap: "8px",
		padding: "8px 12px",
		backgroundColor: "var(--color-surface)",
		borderRadius: "0",
		fontSize: "12px",
	},
	phaseIndicator: {
		display: "flex",
		gap: "4px",
	},
	phaseDot: {
		width: "8px",
		height: "8px",
		borderRadius: "0",
		transition: "all 0.3s ease",
	},
	phaseDotComplete: {
		backgroundColor: "var(--color-success)",
	},
	phaseDotActive: {
		backgroundColor: "var(--color-primary)",
		boxShadow: "0 0 4px var(--color-primary)",
	},
	phaseDotPending: {
		backgroundColor: "var(--color-surface-dark)",
	},
	label: {
		color: "var(--color-text-secondary)",
	},
	phaseName: {
		fontWeight: "bold",
	},
};

// 阶段名称
const phaseNames: Record<MovementPhase, string> = {
	1: "平移A",
	2: "转向",
	3: "平移B",
};

interface MovementPhaseIndicatorProps {
	currentPhase: MovementPhase;
	phase1Complete: boolean;
	phase2Complete: boolean;
	phase3Complete: boolean;
	compact?: boolean;
}

export const MovementPhaseIndicator: React.FC<MovementPhaseIndicatorProps> = ({
	currentPhase,
	phase1Complete,
	phase2Complete,
	phase3Complete,
	compact = false,
}) => {
	const phases = [
		{ phase: 1 as MovementPhase, complete: phase1Complete },
		{ phase: 2 as MovementPhase, complete: phase2Complete },
		{ phase: 3 as MovementPhase, complete: phase3Complete },
	];

	if (compact) {
		return (
			<div style={styles.container}>
				<div style={styles.phaseIndicator}>
					{phases.map(({ phase, complete }) => {
						const isActive = phase === currentPhase && !complete;
						return (
							<div
								key={phase}
								style={{
									...styles.phaseDot,
									...(complete ? styles.phaseDotComplete : {}),
									...(isActive ? styles.phaseDotActive : {}),
									...(!complete && !isActive ? styles.phaseDotPending : {}),
								}}
							/>
						);
					})}
				</div>
				<span style={styles.label}>
					<span style={styles.phaseName}>{phaseNames[currentPhase]}</span>
				</span>
			</div>
		);
	}

	return (
		<div style={{ ...styles.container, padding: "12px 16px" }}>
			<div style={styles.phaseIndicator}>
				{phases.map(({ phase, complete }) => {
					const isActive = phase === currentPhase && !complete;
					return (
						<div
							key={phase}
							style={{
								...styles.phaseDot,
								width: "12px",
								height: "12px",
								...(complete ? styles.phaseDotComplete : {}),
								...(isActive ? styles.phaseDotActive : {}),
								...(!complete && !isActive ? styles.phaseDotPending : {}),
							}}
							title={phaseNames[phase]}
						/>
					);
				})}
			</div>
			<span style={styles.label}>
				移动阶段: <span style={styles.phaseName}>{phaseNames[currentPhase]}</span>
				{phase3Complete && (
					<span style={{ color: "var(--color-success)", marginLeft: "8px" }}>✓ 完成</span>
				)}
			</span>
		</div>
	);
};

export default MovementPhaseIndicator;
