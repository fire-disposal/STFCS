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
		display: "grid",
		gridTemplateColumns: "1fr 1fr 80px",
		gap: "6px",
	},
	input: {
		width: "100%",
		padding: "8px",
		borderRadius: "0",
		border: "1px solid rgba(90, 42, 58, 0.8)",
		backgroundColor: "rgba(26, 45, 66, 0.8)",
		color: "#cfe8ff",
		fontSize: "10px",
		boxSizing: "border-box" as const,
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
	mapCursor: { x: number; y: number; heading: number } | null;
}

// 移除未使用的样式

export const DMObjectCreator: React.FC<DMObjectCreatorProps> = ({
	onCreateObject,
	players,
	mapCursor,
}) => {
	// 折叠状态
	const [collapsed, setCollapsed] = useState(false);
	// 对象类型
	const [objectType, setObjectType] = useState<TokenType>("ship");
	// 选中的舰船 ID
	const [selectedHullId, setSelectedHullId] = useState<string>("frigate_assault");
	// 朝向（从游标继承）
	const [heading, setHeading] = useState(0);
	// 阵营和归属
	const [faction, setFaction] = useState<FactionValue>(Faction.DM);
	const [ownerId, setOwnerId] = useState<string>("");

	// 可用舰船列表
	const availableShips = useMemo(() => getAvailableShips(), []);

	// 处理创建对象 - 直接在游标位置创建
	const handleCreate = useCallback(() => {
		if (!mapCursor) return;

		onCreateObject({
			type: objectType,
			hullId: objectType === "ship" ? selectedHullId : undefined,
			x: mapCursor.x,
			y: mapCursor.y,
			heading: mapCursor.heading,
			faction,
			ownerId: ownerId || undefined,
		});
	}, [objectType, selectedHullId, mapCursor, faction, ownerId, onCreateObject]);

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

					{/* 游标位置提示 */}
					{mapCursor ? (
						<div style={styles.modeHint}>
							🎯 游标位置：({Math.round(mapCursor.x)}, {Math.round(mapCursor.y)}) 朝向：
							{Math.round(mapCursor.heading)}°
						</div>
					) : (
						<div style={styles.modeHint}>🎯 右键点击地图设置游标位置</div>
					)}

					{/* 朝向设置 */}
					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<MapPin className="game-icon--xs" />
							朝向调整
						</div>
						<input
							style={styles.input}
							type="number"
							placeholder="朝向 (0-359)"
							value={heading}
							onChange={(e) => setHeading(Number(e.target.value))}
							min={0}
							max={359}
						/>
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
						disabled={!mapCursor}
					>
						<Sparkles className="game-icon--xs" />
						{mapCursor ? "创建对象" : "请先设置游标位置"}
					</button>
				</div>
			)}
		</div>
	);
};

export default DMObjectCreator;
