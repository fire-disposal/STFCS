/**
 * DM 控制面板
 *
 * DM 专用操作界面：
 * - 创建测试舰船
 * - 清除舰船过载
 * - 修改护甲值
 * - 分配舰船控制权
 * - 强制推进阶段
 */

import type { PlayerState, ShipState } from "@vt/types";
import { PlayerRole } from "@vt/types";
import {
	ChevronDown,
	ChevronRight,
	FastForward,
	FileText,
	Palette,
	Rocket,
	Shield,
	Sparkles,
	User,
	Users,
	Zap,
} from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";

// 样式定义
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
	buttonGroup: {
		display: "flex",
		gap: "6px",
	},
	button: {
		flex: 1,
		padding: "8px 10px",
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
	buttonPrimary: {
		backgroundColor: "rgba(90, 42, 58, 0.9)",
		borderColor: "rgba(255, 111, 143, 0.5)",
	},
	buttonDisabled: {
		opacity: 0.5,
		cursor: "not-allowed",
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
	shipList: {
		display: "flex",
		flexDirection: "column" as const,
		gap: "4px",
		maxHeight: "120px",
		overflowY: "auto" as const,
	},
	shipItem: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		padding: "6px 8px",
		backgroundColor: "#1a2d42",
		border: "1px solid transparent",
		cursor: "pointer",
		transition: "all 0.2s",
		fontSize: "10px",
	},
	shipItemSelected: {
		borderColor: "#ff6f8f",
		backgroundColor: "#3a2a4a",
	},
	emptyState: {
		textAlign: "center" as const,
		color: "#8ba4c7",
		padding: "8px",
		fontSize: "10px",
	},
};

// 象限名称
const quadrantNames = ["前", "前右", "后右", "后", "后左", "前左"];

interface DMControlPanelProps {
	ships: ShipState[];
	players: PlayerState[];
	isDM: boolean;
	onCreateTestShip: (faction: "player" | "dm", x: number, y: number) => void;
	onClearOverload: (shipId: string) => void;
	onSetArmor: (shipId: string, section: number, value: number) => void;
	onAssignShip: (shipId: string, targetSessionId: string) => void;
	onNextPhase: () => void;
	disabled?: boolean;
}

export const DMControlPanel: React.FC<DMControlPanelProps> = ({
	ships,
	players,
	isDM,
	onCreateTestShip,
	onClearOverload,
	onSetArmor,
	onAssignShip,
	onNextPhase,
	disabled = false,
}) => {
	// 折叠状态
	const [collapsed, setCollapsed] = useState(false);
	// 选中的舰船
	const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
	// 选中的玩家
	const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
	// 护甲修改参数
	const [armorSection, setArmorSection] = useState(0);
	const [armorValue, setArmorValue] = useState(100);
	// 创建舰船位置
	const [createX, setCreateX] = useState(200);
	const [createY, setCreateY] = useState(200);

	// 普通玩家列表（排除 DM）
	const regularPlayers = useMemo(() => {
		return players.filter((p) => p.role !== PlayerRole.DM);
	}, [players]);

	// 选中的舰船对象
	const selectedShip = useMemo(() => {
		return ships.find((s) => s.id === selectedShipId) || null;
	}, [ships, selectedShipId]);

	// 过载的舰船列表
	const overloadedShips = useMemo(() => {
		return ships.filter((s) => s.isOverloaded);
	}, [ships]);

	// 清除过载
	const handleClearOverload = useCallback(() => {
		if (selectedShipId) {
			onClearOverload(selectedShipId);
		}
	}, [selectedShipId, onClearOverload]);

	// 修改护甲
	const handleSetArmor = useCallback(() => {
		if (selectedShipId) {
			onSetArmor(selectedShipId, armorSection, armorValue);
		}
	}, [selectedShipId, armorSection, armorValue, onSetArmor]);

	// 分配舰船
	const handleAssignShip = useCallback(() => {
		if (selectedShipId && selectedPlayerId) {
			onAssignShip(selectedShipId, selectedPlayerId);
			setSelectedPlayerId(null);
		}
	}, [selectedShipId, selectedPlayerId, onAssignShip]);

	return (
		<div style={styles.panel}>
			{/* 可折叠头部 */}
			<div style={styles.header} onClick={() => setCollapsed(!collapsed)}>
				<div style={styles.headerTitle}>
					<Palette className="game-icon--sm" />
					DM 控制中心
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
					{/* 快速创建 */}
					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<Rocket className="game-icon--xs" />
							快速创建
						</div>
						<div style={styles.inputRow}>
							<input
								style={styles.input}
								type="number"
								placeholder="X"
								value={createX}
								onChange={(e) => setCreateX(Number(e.target.value))}
								disabled={disabled}
							/>
							<input
								style={styles.input}
								type="number"
								placeholder="Y"
								value={createY}
								onChange={(e) => setCreateY(Number(e.target.value))}
								disabled={disabled}
							/>
						</div>
						<div style={styles.buttonGroup}>
							<button
								data-magnetic
								className="game-btn game-btn--primary game-btn--small"
								onClick={() => onCreateTestShip("player", createX, createY)}
								disabled={disabled}
							>
								<User className="game-icon--xs" />
								玩家舰船
							</button>
							<button
								data-magnetic
								className="game-btn game-btn--primary game-btn--small"
								onClick={() => onCreateTestShip("dm", createX, createY)}
								disabled={disabled}
							>
								<Palette className="game-icon--xs" />
								DM 舰船
							</button>
						</div>
					</div>

					{/* 选择舰船 */}
					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<FileText className="game-icon--xs" />
							选择舰船
						</div>
						{ships.length > 0 ? (
							<div style={styles.shipList}>
								{ships.map((ship) => (
									<div
										key={ship.id}
										style={{
											...styles.shipItem,
											...(selectedShipId === ship.id ? styles.shipItemSelected : {}),
										}}
										onClick={() => setSelectedShipId(ship.id)}
									>
										<span>{ship.hullType}</span>
										<span style={{ color: ship.ownerId ? "#2ecc71" : "#8ba4c7" }}>
											{ship.ownerId ? "已分配" : "未分配"}
										</span>
									</div>
								))}
							</div>
						) : (
							<div style={styles.emptyState}>暂无舰船</div>
						)}
					</div>

					{/* 清除过载 */}
					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<Zap className="game-icon--xs" />
							清除过载 ({overloadedShips.length})
						</div>
						{selectedShip && selectedShip.isOverloaded ? (
							<button
								data-magnetic
								className="game-btn game-btn--primary game-btn--full"
								onClick={handleClearOverload}
								disabled={disabled}
							>
								<Sparkles className="game-icon--xs" />
								清除 {selectedShip.hullType} 的过载
							</button>
						) : (
							<div style={styles.emptyState}>{selectedShip ? "该舰船未过载" : "请先选择舰船"}</div>
						)}
					</div>

					{/* 修改护甲 */}
					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<Shield className="game-icon--xs" />
							修改护甲
						</div>
						{selectedShip ? (
							<>
								<select
									style={styles.select}
									value={armorSection}
									onChange={(e) => setArmorSection(Number(e.target.value))}
									disabled={disabled}
								>
									{quadrantNames.map((name, index) => (
										<option key={index} value={index}>
											{name} ({selectedShip.armorCurrent[index]}/{selectedShip.armorMax[index]})
										</option>
									))}
								</select>
								<input
									style={styles.input}
									type="number"
									value={armorValue}
									onChange={(e) => setArmorValue(Number(e.target.value))}
									min={0}
									max={selectedShip.armorMax[armorSection]}
									disabled={disabled}
								/>
								<button
									data-magnetic
									className="game-btn game-btn--primary game-btn--full"
									onClick={handleSetArmor}
									disabled={disabled}
								>
									修改护甲
								</button>
							</>
						) : (
							<div style={styles.emptyState}>请先选择舰船</div>
						)}
					</div>

					{/* 分配舰船 */}
					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<Users className="game-icon--xs" />
							分配舰船
						</div>
						{selectedShip && regularPlayers.length > 0 ? (
							<>
								<select
									style={styles.select}
									value={selectedPlayerId || ""}
									onChange={(e) => setSelectedPlayerId(e.target.value)}
									disabled={disabled}
								>
									<option value="">选择玩家...</option>
									{regularPlayers.map((player) => (
										<option key={player.sessionId} value={player.sessionId}>
											{player.name}
										</option>
									))}
								</select>
								<button
									data-magnetic
									className="game-btn game-btn--primary game-btn--full"
									onClick={handleAssignShip}
									disabled={!selectedPlayerId || disabled}
								>
									分配给玩家
								</button>
							</>
						) : (
							<div style={styles.emptyState}>
								{regularPlayers.length === 0 ? "无在线玩家" : "请先选择舰船"}
							</div>
						)}
					</div>

					{/* 阶段控制 */}
					<div style={styles.section}>
						<div style={styles.sectionTitle}>
							<FastForward className="game-icon--xs" />
							阶段控制
						</div>
						<button
							data-magnetic
							className="game-btn game-btn--primary game-btn--full"
							onClick={onNextPhase}
							disabled={disabled}
						>
							<FastForward className="game-icon--xs" />
							强制进入下一阶段
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default DMControlPanel;
