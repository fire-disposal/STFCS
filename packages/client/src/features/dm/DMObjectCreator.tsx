/**
 * DM 对象创建面板
 *
 * 提供舰船、小行星、空间站等对象的创建和摆放功能
 * 游标朝向通过调整视图旋转控制，放置时自动继承
 */

import { getAvailableShips } from "@vt/data";
import type { FactionValue } from "@vt/types";
import { Faction } from "@vt/types";
import { ChevronDown, ChevronRight, Palette, Rocket, Sparkles, Users } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";

type TokenType = "ship" | "station" | "asteroid";

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
	select: {
		width: "100%",
		padding: "8px",
		borderRadius: "0",
		border: "1px solid rgba(90, 42, 58, 0.8)",
		backgroundColor: "rgba(26, 45, 66, 0.8)",
		color: "#cfe8ff",
		fontSize: "10px",
	},
	cursorInfo: {
		padding: "10px",
		borderRadius: "0",
		backgroundColor: "rgba(74, 158, 255, 0.15)",
		border: "1px solid rgba(74, 158, 255, 0.3)",
		display: "flex",
		flexDirection: "column" as const,
		gap: "6px",
	},
	cursorCoords: {
		color: "#4a9eff",
		fontSize: "11px",
		fontWeight: "bold" as const,
	},
	cursorHint: {
		color: "#8ba4c7",
		fontSize: "9px",
	},
	noCursorHint: {
		padding: "10px",
		borderRadius: "0",
		backgroundColor: "rgba(255, 111, 143, 0.15)",
		border: "1px dashed rgba(255, 111, 143, 0.4)",
		color: "#ff6f8f",
		fontSize: "10px",
		textAlign: "center" as const,
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
	mapCursor: { x: number; y: number; r: number } | null;
}

export const DMObjectCreator: React.FC<DMObjectCreatorProps> = ({
	onCreateObject,
	players,
	mapCursor,
}) => {
	const [collapsed, setCollapsed] = useState(false);
	const [objectType, setObjectType] = useState<TokenType>("ship");
	const [selectedHullId, setSelectedHullId] = useState<string>("frigate_assault");
	const [faction, setFaction] = useState<FactionValue>(Faction.DM);
	const [ownerId, setOwnerId] = useState<string>("");

	const availableShips = useMemo(() => getAvailableShips(), []);

	const handleCreate = useCallback(() => {
		if (!mapCursor) return;

		onCreateObject({
			type: objectType,
			hullId: objectType === "ship" ? selectedHullId : undefined,
			x: mapCursor.x,
			y: mapCursor.y,
			heading: mapCursor.r,
			faction,
			ownerId: ownerId || undefined,
		});
	}, [objectType, selectedHullId, mapCursor, faction, ownerId, onCreateObject]);

	return (
		<div style={styles.panel}>
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

			{!collapsed && (
				<div style={styles.content}>
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

					{mapCursor ? (
						<div style={styles.cursorInfo}>
							<div style={styles.cursorCoords}>
								🎯 ({Math.round(mapCursor.x)}, {Math.round(mapCursor.y)}) ·{" "}
								{Number((-mapCursor.r).toFixed(2))}°
							</div>
							<div style={styles.cursorHint}>提示：调整视图旋转可改变后续游标朝向</div>
						</div>
					) : (
						<div style={styles.noCursorHint}>🎯 左键点击地图空白处放置游标</div>
					)}

					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<Users className="game-icon--xs" />
							阵营与归属
						</div>
						<select
							style={styles.select}
							value={faction}
							onChange={(e) => setFaction(Number(e.target.value) as unknown as FactionValue)}
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
								<option value="">未分配</option>
								{players
									.filter((p) => p.role !== "DM")
									.map((player) => (
										<option key={player.sessionId} value={player.sessionId}>
											{player.name}
										</option>
									))}
							</select>
						)}
					</div>

					<button
						data-magnetic
						className="game-btn game-btn--primary game-btn--full"
						onClick={handleCreate}
						disabled={!mapCursor}
					>
						<Sparkles className="game-icon--xs" />
						{mapCursor ? "在游标位置创建" : "需要先放置游标"}
					</button>
				</div>
			)}
		</div>
	);
};

export default DMObjectCreator;
