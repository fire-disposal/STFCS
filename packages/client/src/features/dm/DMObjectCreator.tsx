/**
 * DM 对象创建面板
 *
 * 提供舰船、小行星、空间站等对象的创建和摆放功能
 * 样式与 DMControlPanel 保持一致
 */

import type { FactionValue } from "@vt/contracts";
import { Faction } from "@vt/contracts";
import { getAvailableShips } from "@vt/rules";
import { ChevronDown, ChevronRight, MapPin, Palette, Rocket, Sparkles, Users } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";

type TokenType = "ship" | "station" | "asteroid";

// 样式定义 - 与 DMControlPanel 保持一致
const styles = {
	panel: {
		backgroundColor: "rgba(6, 16, 26, 0.95)",
		borderRadius: "0",
		border: "1px solid rgba(255, 111, 143, 0.3)",
		overflow: "hidden",
	},
	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "10px 12px",
		backgroundColor: "rgba(90, 42, 58, 0.6)",
		borderBottom: "1px solid rgba(255, 111, 143, 0.3)",
		cursor: "pointer",
		userSelect: "none" as const,
	},
	headerTitle: {
		fontSize: "11px",
		fontWeight: "bold" as const,
		color: "#ff6f8f",
		letterSpacing: "1px",
		textTransform: "uppercase" as const,
		display: "flex",
		alignItems: "center",
		gap: "6px",
	},
	collapseButton: {
		background: "transparent",
		border: "none",
		color: "#ff6f8f",
		fontSize: "16px",
		cursor: "pointer",
		padding: "0",
		width: "20px",
		height: "20px",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	content: {
		padding: "12px",
		display: "flex",
		flexDirection: "column" as const,
		gap: "12px",
	},
	section: {
		display: "flex",
		flexDirection: "column" as const,
		gap: "6px",
	},
	sectionTitle: {
		fontSize: "10px",
		fontWeight: "bold" as const,
		color: "#ff6f8f",
		letterSpacing: "1px",
		textTransform: "uppercase" as const,
	},
	objectTypeGrid: {
		display: "grid",
		gridTemplateColumns: "repeat(3, 1fr)",
		gap: "6px",
	},
	objectTypeButton: {
		padding: "8px",
		borderRadius: "0",
		border: "1px solid rgba(90, 42, 58, 0.8)",
		backgroundColor: "rgba(58, 42, 74, 0.6)",
		color: "#ff6f8f",
		fontSize: "10px",
		fontWeight: "bold" as const,
		cursor: "pointer",
		transition: "all 0.2s",
		letterSpacing: "0.5px",
	},
	objectTypeButtonActive: {
		backgroundColor: "rgba(90, 42, 58, 0.9)",
		borderColor: "rgba(255, 111, 143, 0.5)",
	},
	shipGrid: {
		display: "grid",
		gridTemplateColumns: "repeat(2, 1fr)",
		gap: "6px",
		maxHeight: "150px",
		overflowY: "auto" as const,
		padding: "4px",
	},
	shipCard: {
		padding: "8px",
		borderRadius: "0",
		border: "1px solid rgba(90, 42, 58, 0.5)",
		backgroundColor: "rgba(26, 45, 66, 0.8)",
		cursor: "pointer",
		transition: "all 0.2s",
		fontSize: "10px",
	},
	shipCardSelected: {
		borderColor: "#ff6f8f",
		backgroundColor: "rgba(90, 42, 58, 0.4)",
	},
	shipCardName: {
		color: "#cfe8ff",
		fontWeight: "bold",
		marginBottom: "4px",
		fontSize: "10px",
		display: "flex",
		alignItems: "center",
		gap: "4px",
	},
	shipCardStats: {
		color: "#8ba4c7",
		fontSize: "9px",
		display: "flex",
		flexDirection: "column" as const,
		gap: "2px",
	},
	inputRow: {
		display: "flex",
		gap: "6px",
	},
	input: {
		flex: 1,
		padding: "8px",
		borderRadius: "0",
		border: "1px solid rgba(90, 42, 58, 0.8)",
		backgroundColor: "rgba(26, 45, 66, 0.8)",
		color: "#cfe8ff",
		fontSize: "10px",
	},
	select: {
		width: "100%",
		padding: "8px",
		borderRadius: "0",
		border: "1px solid rgba(90, 42, 58, 0.8)",
		backgroundColor: "rgba(26, 45, 66, 0.8)",
		color: "#cfe8ff",
		fontSize: "10px",
	},
	modeHint: {
		padding: "8px",
		borderRadius: "0",
		backgroundColor: "rgba(255, 111, 143, 0.2)",
		color: "#ff6f8f",
		fontSize: "10px",
		textAlign: "center" as const,
		border: "1px dashed rgba(255, 111, 143, 0.4)",
	},
	emptyState: {
		textAlign: "center" as const,
		color: "#8ba4c7",
		padding: "8px",
		fontSize: "10px",
	},
};

const objectTypes = [
	{ id: "ship" as TokenType, label: "舰船", icon: "🚀" },
	{ id: "station" as TokenType, label: "空间站", icon: "🛰️" },
	{ id: "asteroid" as TokenType, label: "小行星", icon: "☄️" },
] as const;

const ShipSizeIcons: Record<string, string> = {
	fighter: "🛩️",
	frigate: "🚀",
	destroyer: "🚢",
	cruiser: "🛳️",
	capital: "🏢",
};

interface DMObjectCreatorProps {
	onCreateObject: (params: {
		type: TokenType;
		hullId?: string;
		x: number;
		y: number;
		heading: number;
		faction: FactionValue;
		ownerId?: string;
	}) => void;
	players: Array<{ sessionId: string; name: string; role: string }>;
	isPlacementMode: boolean;
	onTogglePlacementMode: () => void;
}

export const DMObjectCreator: React.FC<DMObjectCreatorProps> = ({
	onCreateObject,
	players,
	isPlacementMode,
	onTogglePlacementMode,
}) => {
	// 折叠状态
	const [collapsed, setCollapsed] = useState(false);
	// 对象类型
	const [objectType, setObjectType] = useState<TokenType>("ship");
	// 选中的舰船 ID
	const [selectedHullId, setSelectedHullId] = useState<string>("frigate_assault");
	// 摆放位置
	const [positionX, setPositionX] = useState(0);
	const [positionY, setPositionY] = useState(0);
	const [heading, setHeading] = useState(0);
	// 阵营和归属
	const [faction, setFaction] = useState<FactionValue>(Faction.DM);
	const [ownerId, setOwnerId] = useState<string>("");

	// 可用舰船列表
	const availableShips = useMemo(() => getAvailableShips(), []);

	// 重置状态
	const resetState = useCallback(() => {
		setPositionX(0);
		setPositionY(0);
		setHeading(0);
		setFaction(Faction.DM);
		setOwnerId("");
	}, []);

	// 处理创建对象 - 手动模式直接创建
	const handleCreate = useCallback(() => {
		onCreateObject({
			type: objectType,
			hullId: objectType === "ship" ? selectedHullId : undefined,
			x: positionX,
			y: positionY,
			heading,
			faction,
			ownerId: ownerId || undefined,
		});
		resetState();
	}, [
		objectType,
		selectedHullId,
		positionX,
		positionY,
		heading,
		faction,
		ownerId,
		onCreateObject,
		resetState,
	]);

	// 准备摆放数据 - 点击摆放模式下调用
	const preparePlacement = useCallback(() => {
		onCreateObject({
			type: objectType,
			hullId: objectType === "ship" ? selectedHullId : undefined,
			x: positionX,
			y: positionY,
			heading,
			faction,
			ownerId: ownerId || undefined,
		});
	}, [objectType, selectedHullId, positionX, positionY, heading, faction, ownerId, onCreateObject]);

	// 启用点击摆放模式
	const enableClickPlacement = useCallback(() => {
		if (!isPlacementMode) {
			preparePlacement();
			onTogglePlacementMode();
		}
	}, [isPlacementMode, preparePlacement, onTogglePlacementMode]);

	return (
		<div style={styles.panel}>
			{/* 可折叠头部 */}
			<div style={styles.header} onClick={() => setCollapsed(!collapsed)}>
				<div style={styles.headerTitle}>
					<Sparkles className="game-icon--sm" />
					对象创建工具
				</div>
				<button style={styles.collapseButton}>
					{collapsed ? (
						<ChevronRight className="game-icon--xs" />
					) : (
						<ChevronDown className="game-icon--xs" />
					)}
				</button>
			</div>

			{/* 内容区 */}
			{!collapsed && (
				<div style={styles.content}>
					{/* 对象类型选择 */}
					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<Palette className="game-icon--xs" />
							对象类型
						</div>
						<div style={styles.objectTypeGrid}>
							{objectTypes.map((type) => (
								<button
									key={type.id}
									data-magnetic
									style={{
										...styles.objectTypeButton,
										...(objectType === type.id ? styles.objectTypeButtonActive : {}),
									}}
									className="game-btn game-btn--small"
									onClick={() => setObjectType(type.id)}
								>
									{type.icon} {type.label}
								</button>
							))}
						</div>
					</div>

					{/* 舰船选择（仅当类型为 ship 时） */}
					{objectType === "ship" && (
						<div style={styles.section}>
							<div style={styles.sectionTitle}>
								<Rocket className="game-icon--xs" />
								选择舰船型号
							</div>
							<div style={styles.shipGrid}>
								{availableShips.map((ship) => (
									<div
										key={ship.id}
										data-magnetic
										style={{
											...styles.shipCard,
											...(selectedHullId === ship.id ? styles.shipCardSelected : {}),
										}}
										onClick={() => setSelectedHullId(ship.id)}
									>
										<div style={styles.shipCardName}>
											<span>{ShipSizeIcons[ship.size]}</span>
											<span>{ship.name}</span>
										</div>
										<div style={styles.shipCardStats}>
											<span>船体：{ship.hullPoints}</span>
											<span>装甲：{ship.armorValue}</span>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* 摆放模式提示 */}
					{isPlacementMode && <div style={styles.modeHint}>🎯 请点击地图选择摆放位置</div>}

					{/* 位置设置 */}
					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<MapPin className="game-icon--xs" />
							摆放位置
						</div>
						<div style={styles.inputRow}>
							<input
								style={styles.input}
								type="number"
								placeholder="X"
								value={positionX}
								onChange={(e) => setPositionX(Number(e.target.value))}
								disabled={isPlacementMode}
							/>
							<input
								style={styles.input}
								type="number"
								placeholder="Y"
								value={positionY}
								onChange={(e) => setPositionY(Number(e.target.value))}
								disabled={isPlacementMode}
							/>
							<input
								style={styles.input}
								type="number"
								placeholder="朝向"
								value={heading}
								onChange={(e) => setHeading(Number(e.target.value))}
								min={0}
								max={359}
							/>
						</div>
						<button
							data-magnetic
							className="game-btn game-btn--primary game-btn--full"
							onClick={() => {
								if (!isPlacementMode) {
									preparePlacement();
									onTogglePlacementMode();
								}
							}}
							disabled={isPlacementMode}
						>
							<MapPin className="game-icon--xs" />
							{isPlacementMode ? "请点击地图选择位置" : "点击地图选择位置"}
						</button>
					</div>

					{/* 阵营和归属权 */}
					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<Users className="game-icon--xs" />
							阵营与归属
						</div>
						<select
							style={styles.select}
							value={faction}
							onChange={(e) => setFaction(e.target.value as FactionValue)}
						>
							<option value={Faction.PLAYER}>玩家阵营</option>
							<option value={Faction.DM}>DM 阵营（敌方）</option>
						</select>
						{faction === Faction.PLAYER && (
							<select
								style={styles.select}
								value={ownerId}
								onChange={(e) => setOwnerId(e.target.value)}
							>
								<option value="">未分配（自由控制）</option>
								{players
									.filter((p) => p.role !== "dm")
									.map((player) => (
										<option key={player.sessionId} value={player.sessionId}>
											{player.name}
										</option>
									))}
							</select>
						)}
					</div>

					{/* 创建按钮 */}
					<button
						data-magnetic
						className="game-btn game-btn--primary game-btn--full"
						onClick={handleCreate}
					>
						<Sparkles className="game-icon--xs" />
						创建对象
					</button>
				</div>
			)}
		</div>
	);
};

export default DMObjectCreator;
