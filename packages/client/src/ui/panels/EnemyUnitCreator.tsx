/**
 * 敌方单位创建器组件
 *
 * DM 使用此组件创建敌方单位：
 * - 选择舰船定义
 * - 设置初始位置和朝向
 * - 配置阵营
 */

import type { FactionValue, HullSizeValue, Point } from "@/sync/types";
import type { ShipHullSpec } from "@vt/rules";
import React, { useState, useCallback } from "react";

// 样式
const styles = {
	container: {
		backgroundColor: "var(--color-surface)",
		borderRadius: "0",
		padding: "16px",
		boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
	},
	header: {
		fontSize: "16px",
		fontWeight: "bold",
		marginBottom: "16px",
		display: "flex",
		alignItems: "center",
		gap: "8px",
	},
	section: {
		marginBottom: "16px",
	},
	sectionTitle: {
		fontSize: "12px",
		fontWeight: "bold",
		color: "var(--color-text-secondary)",
		marginBottom: "8px",
		textTransform: "uppercase" as const,
	},
	shipList: {
		maxHeight: "200px",
		overflow: "auto",
		display: "flex",
		flexDirection: "column" as const,
		gap: "4px",
	},
	shipItem: {
		display: "flex",
		alignItems: "center",
		padding: "8px",
		backgroundColor: "var(--color-background)",
		borderRadius: "0",
		cursor: "pointer",
		transition: "all 0.2s ease",
		border: "2px solid transparent",
	},
	shipItemSelected: {
		borderColor: "var(--color-primary)",
		backgroundColor: "var(--color-primary-light)",
	},
	shipIcon: {
		width: "32px",
		height: "32px",
		borderRadius: "0",
		backgroundColor: "var(--color-surface-dark)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		marginRight: "8px",
		fontSize: "16px",
	},
	shipName: {
		flex: 1,
		fontSize: "13px",
	},
	inputGroup: {
		display: "grid",
		gridTemplateColumns: "repeat(2, 1fr)",
		gap: "8px",
	},
	inputField: {
		display: "flex",
		flexDirection: "column" as const,
		gap: "4px",
	},
	label: {
		fontSize: "11px",
		color: "var(--color-text-secondary)",
	},
	input: {
		padding: "8px",
		borderRadius: "0",
		border: "1px solid var(--color-border)",
		backgroundColor: "var(--color-background)",
		color: "var(--color-text)",
		fontSize: "13px",
	},
	select: {
		padding: "8px",
		borderRadius: "0",
		border: "1px solid var(--color-border)",
		backgroundColor: "var(--color-background)",
		color: "var(--color-text)",
		fontSize: "13px",
		cursor: "pointer",
	},
	factionSelect: {
		display: "flex",
		gap: "8px",
	},
	factionButton: {
		flex: 1,
		padding: "8px",
		borderRadius: "0",
		border: "1px solid var(--color-border)",
		backgroundColor: "var(--color-background)",
		cursor: "pointer",
		fontSize: "12px",
		transition: "all 0.2s ease",
	},
	factionButtonSelected: {
		backgroundColor: "var(--color-primary)",
		color: "white",
		borderColor: "var(--color-primary)",
	},
	buttons: {
		display: "flex",
		gap: "8px",
		marginTop: "16px",
	},
	button: {
		flex: 1,
		padding: "10px",
		borderRadius: "0",
		border: "none",
		cursor: "pointer",
		fontSize: "14px",
		fontWeight: "bold",
		transition: "all 0.2s ease",
	},
	primaryButton: {
		backgroundColor: "var(--color-primary)",
		color: "white",
	},
	secondaryButton: {
		backgroundColor: "var(--color-surface-dark)",
		color: "var(--color-text)",
	},
	disabledButton: {
		opacity: 0.5,
		cursor: "not-allowed",
	},
};

// 阵营列表
const factions: Array<{ id: FactionValue; name: string; color: string }> = [
	{ id: "hegemony", name: "霸主", color: "#4a90d9" },
	{ id: "sindrian", name: "辛德里亚", color: "#d4af37" },
	{ id: "persean", name: "珀尔修斯", color: "#2ecc71" },
	{ id: "tri_tachyon", name: "三叠纪", color: "#9b59b6" },
	{ id: "pirate", name: "海盗", color: "#e74c3c" },
	{ id: "independent", name: "独立", color: "#95a5a6" },
];

// 舰船尺寸图标
const hullSizeIcons: Record<HullSizeValue, string> = {
	FIGHTER: "✈️",
	FRIGATE: "🚀",
	DESTROYER: "🛡️",
	CRUISER: "⚔️",
	CAPITAL: "🏛️",
};

interface EnemyUnitCreatorProps {
	availableShips: ShipHullSpec[];
	onCreate: (params: {
		shipDefinitionId: string;
		position: Point;
		heading: number;
		faction: FactionValue;
		name?: string;
	}) => void;
	onCancel?: () => void;
	defaultPosition?: Point;
	defaultHeading?: number;
}

export const EnemyUnitCreator: React.FC<EnemyUnitCreatorProps> = ({
	availableShips,
	onCreate,
	onCancel,
	defaultPosition = { x: 0, y: 0 },
	defaultHeading = 0,
}) => {
	const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
	const [position, setPosition] = useState<Point>(defaultPosition);
	const [heading, setHeading] = useState(defaultHeading);
	const [faction, setFaction] = useState<FactionValue>("pirate");
	const [name, setName] = useState("");

	// 选中的舰船
	const selectedShip = availableShips.find((s) => s.id === selectedShipId);

	// 处理创建
	const handleCreate = useCallback(() => {
		if (!selectedShipId) return;

		onCreate({
			shipDefinitionId: selectedShipId,
			position,
			heading,
			faction,
			name: name || undefined,
		});

		// 重置状态
		setSelectedShipId(null);
		setName("");
	}, [selectedShipId, position, heading, faction, name, onCreate]);

	// 是否可以创建
	const canCreate = selectedShipId !== null;

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<span>👾</span>
				<span>创建敌方单位</span>
			</div>

			{/* 舰船选择 */}
			<div style={styles.section}>
				<div style={styles.sectionTitle}>选择舰船</div>
				<div style={styles.shipList}>
					{availableShips.map((ship) => (
						<div
							key={ship.id}
							style={{
								...styles.shipItem,
								...(selectedShipId === ship.id ? styles.shipItemSelected : {}),
							}}
							onClick={() => setSelectedShipId(ship.id)}
						>
							<div style={styles.shipIcon}>{hullSizeIcons.FRIGATE}</div>
							<div style={styles.shipName}>{ship.name}</div>
							{ship.size && (
								<span style={{ fontSize: "12px", color: "var(--color-primary)" }}>
									{ship.size}
								</span>
							)}
						</div>
					))}
				</div>
			</div>

			{/* 位置设置 */}
			<div style={styles.section}>
				<div style={styles.sectionTitle}>位置设置</div>
				<div style={styles.inputGroup}>
					<div style={styles.inputField}>
						<span style={styles.label}>X 坐标</span>
						<input
							type="number"
							style={styles.input}
							value={position.x}
							onChange={(e) => setPosition((p) => ({ ...p, x: Number(e.target.value) }))}
						/>
					</div>
					<div style={styles.inputField}>
						<span style={styles.label}>Y 坐标</span>
						<input
							type="number"
							style={styles.input}
							value={position.y}
							onChange={(e) => setPosition((p) => ({ ...p, y: Number(e.target.value) }))}
						/>
					</div>
					<div style={styles.inputField}>
						<span style={styles.label}>朝向 (度)</span>
						<input
							type="number"
							min={0}
							max={359}
							style={styles.input}
							value={heading}
							onChange={(e) => setHeading(Number(e.target.value) % 360)}
						/>
					</div>
					<div style={styles.inputField}>
						<span style={styles.label}>名称 (可选)</span>
						<input
							type="text"
							style={styles.input}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="自定义名称"
						/>
					</div>
				</div>
			</div>

			{/* 阵营选择 */}
			<div style={styles.section}>
				<div style={styles.sectionTitle}>阵营</div>
				<div style={styles.factionSelect}>
					{factions.map((f) => (
						<button
							key={f.id}
							style={{
								...styles.factionButton,
								...(faction === f.id ? styles.factionButtonSelected : {}),
								borderColor: f.color,
							}}
							onClick={() => setFaction(f.id)}
						>
							{f.name}
						</button>
					))}
				</div>
			</div>

			{/* 按钮 */}
			<div style={styles.buttons}>
				{onCancel && (
					<button style={{ ...styles.button, ...styles.secondaryButton }} onClick={onCancel}>
						取消
					</button>
				)}
				<button
					style={{
						...styles.button,
						...styles.primaryButton,
						...(!canCreate ? styles.disabledButton : {}),
					}}
					onClick={handleCreate}
					disabled={!canCreate}
				>
					创建单位
				</button>
			</div>
		</div>
	);
};

export default EnemyUnitCreator;
