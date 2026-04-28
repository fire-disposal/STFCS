/**
 * TopBar - 游戏顶栏组件
 *
 * 布局：
 * 左侧：回合条（紧凑）
 * 中部：玩家头像（按阵营分组）
 * 中右侧：选中舰船状态条（新增）
 * 右侧：派系选择、存档、设置、退出按钮
 */

import React, { useState, useCallback, useMemo } from "react";
import { Settings, LogOut, Flag } from "lucide-react";
import TurnBar from "./TurnBar";
import { GamePhase, Faction, FactionColors, FactionLabels, TURN_ORDER } from "@vt/data";
import type { RoomPlayerState, CombatToken } from "@vt/data";
import { Avatar } from "@/ui/shared/Avatar";
import { SaveMenu } from "./SaveMenu";
import { useUIStore } from "@/state/stores/uiStore";
import {
	useGamePhase,
	useGameTurnCount,
	useGameActiveFaction,
	useGamePlayers,
	useAllTokens,
	useGamePlayerId,
} from "@/state/stores/gameStore";
import "./top-bar.css";

interface TopBarProps {
	onReadyToggle: () => void;
	onSettings: () => void;
	onLeave: () => void;
	onFactionChange?: (playerId: string, faction: Faction) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
	onReadyToggle,
	onSettings,
	onLeave,
	onFactionChange,
}) => {
	// 从 Zustand 直接获取所有游戏状态
	const phase = useGamePhase();
	const turnCount = useGameTurnCount();
	const activeFaction = useGameActiveFaction();
	const players = useGamePlayers();
	const tokens = useAllTokens();
	const playerId = useGamePlayerId();
	const currentPlayer = playerId ? players[playerId] : undefined;
	const currentFaction = currentPlayer?.faction;
	const isHost = currentPlayer?.role === "HOST";
	const isReady = currentPlayer?.isReady ?? false;
	const inRoom = true;

	// 直接从 uiStore 获取选中的舰船
	const selectedShipId = useUIStore((state) => state.selectedShipId);
	const selectedShip = tokens.find((t) => t.$id === selectedShipId) ?? null;

	return (
		<div className="top-bar">
			<div className="top-bar__left">
				<TurnBar
					phase={phase}
					turnCount={turnCount}
					activeFaction={activeFaction}
					players={players}
					tokens={tokens}
					currentFaction={currentFaction}
					isReady={isReady}
					onReadyToggle={onReadyToggle}
				/>
			</div>

			<div className="top-bar__center">
				<PlayerAvatars players={players} phase={phase} activeFaction={activeFaction} />
			</div>

			{/* 舰船状态条 */}
			{selectedShip && selectedShip.runtime && (
				<div className="top-bar__ship-status">
					<ShipStatusBar ship={selectedShip} />
				</div>
			)}

			<div className="top-bar__right">
				{/* 派系选择器 */}
				<FactionSelector
					currentFaction={currentFaction}
					currentPlayerId={playerId}
					onFactionChange={onFactionChange}
				/>
				<SaveMenu isHost={isHost} inRoom={inRoom} />
				<button className="top-bar__action-btn" onClick={onSettings}>
					<Settings size={16} />
					设置
				</button>
				<button className="top-bar__action-btn top-bar__action-btn--danger" onClick={onLeave}>
					<LogOut size={16} />
					离开
				</button>
			</div>
		</div>
	);
};

/**
 * 派系选择器组件
 * 允许玩家为自己选择所属派系
 */
const FactionSelector: React.FC<{
	currentFaction: Faction | undefined;
	currentPlayerId: string | null;
	onFactionChange?: (playerId: string, faction: Faction) => void;
}> = ({ currentFaction, currentPlayerId, onFactionChange }) => {
	const [open, setOpen] = useState(false);

	const handleSelect = useCallback((faction: Faction) => {
		if (currentPlayerId && onFactionChange) {
			onFactionChange(currentPlayerId, faction);
		}
		setOpen(false);
	}, [currentPlayerId, onFactionChange]);

	if (!currentPlayerId || !onFactionChange) return null;

	const factionOptions = Object.values(Faction) as Faction[];

	return (
		<div className="top-bar__faction-selector" style={{ position: "relative" }}>
			<button
				className="top-bar__action-btn"
				onClick={() => setOpen(!open)}
				title={currentFaction ? `${FactionLabels[currentFaction]}` : "选择派系"}
				style={{
					borderColor: currentFaction ? `#${FactionColors[currentFaction].toString(16).padStart(6, "0")}` : undefined,
					borderWidth: 1,
					borderStyle: "solid",
				}}
			>
				<Flag size={16} />
				{currentFaction ? FactionLabels[currentFaction] : "派系"}
			</button>
			{open && (
				<div
					className="top-bar__faction-dropdown"
					style={{
						position: "absolute",
						top: "100%",
						right: 0,
						background: "#141a24",
						border: "1px solid #2a3440",
						borderRadius: 6,
						padding: 4,
						zIndex: 100,
						minWidth: 140,
					}}
				>
					{factionOptions.map((faction) => (
						<button
							key={faction}
							className="top-bar__faction-option"
							onClick={() => handleSelect(faction)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								width: "100%",
								padding: "6px 10px",
								background: currentFaction === faction ? "rgba(74, 158, 255, 0.15)" : "transparent",
								border: "none",
								borderRadius: 4,
								color: "#cfe8ff",
								cursor: "pointer",
								fontSize: 12,
							}}
							onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(74, 158, 255, 0.1)")}
							onMouseLeave={(e) => (e.currentTarget.style.background = currentFaction === faction ? "rgba(74, 158, 255, 0.15)" : "transparent")}
						>
							<span
								style={{
									width: 10,
									height: 10,
									borderRadius: "50%",
									background: `#${FactionColors[faction].toString(16).padStart(6, "0")}`,
									display: "inline-block",
								}}
							/>
							{FactionLabels[faction]}
						</button>
					))}
				</div>
			)}
		</div>
	);
};

const PlayerAvatars: React.FC<{
	players: Record<string, RoomPlayerState>;
	phase: GamePhase;
	activeFaction: Faction | undefined;
}> = ({ players, phase, activeFaction }) => {
	const playerList = Object.values(players).filter((p) => p.connected);

	// 按 TURN_ORDER 排序阵营，同阵营内按昵称排序
	const grouped = useMemo(() => {
		const result: { faction: Faction | undefined; players: RoomPlayerState[] }[] = [];

		// 按 TURN_ORDER 顺序处理有派系的玩家
		for (const faction of TURN_ORDER) {
			const factionPlayers = playerList
				.filter((p) => p.faction === faction)
				.sort((a, b) => a.nickname.localeCompare(b.nickname));
			if (factionPlayers.length > 0) {
				result.push({ faction, players: factionPlayers });
			}
		}

		// 无派系玩家放在最后
		const unaffiliated = playerList
			.filter((p) => !p.faction)
			.sort((a, b) => a.nickname.localeCompare(b.nickname));
		if (unaffiliated.length > 0) {
			result.push({ faction: undefined, players: unaffiliated });
		}

		return result;
	}, [playerList]);

	return (
		<div className="top-bar__avatars">
			{grouped.map((group, index) => (
				<React.Fragment key={group.faction ?? `unaffiliated-${index}`}>
					{index > 0 && <div className="top-bar__avatar-divider" />}
					<div className="top-bar__avatar-group">
						{group.players.map((player) => (
							<PlayerAvatar
								key={player.sessionId}
								player={player}
								phase={phase}
								faction={group.faction}
								activeFaction={activeFaction}
							/>
						))}
					</div>
				</React.Fragment>
			))}
		</div>
	);
};

const PlayerAvatar: React.FC<{
	player: RoomPlayerState;
	phase: GamePhase;
	faction?: Faction;
	activeFaction: Faction | undefined;
}> = ({ player, phase, faction, activeFaction }) => {
	/**
	 * 指示灯颜色逻辑：
	 * - 默认（非 PLAYER_ACTION 阶段）：灰色
	 * - 当前玩家回合（activeFaction === player.faction）且未准备：蓝色
	 * - 当前玩家回合（activeFaction === player.faction）且已准备：绿色
	 * - 不在当前玩家回合（activeFaction !== player.faction）：红色
	 */
	const getDotState = (): "default" | "current-not-ready" | "current-ready" | "other-turn" => {
		if (phase !== "PLAYER_ACTION") return "default";
		if (!faction) return "default";
		if (activeFaction === faction) {
			return player.isReady ? "current-ready" : "current-not-ready";
		}
		return "other-turn";
	};

	const dotState = getDotState();

	const factionColor = faction ? FactionColors[faction] : undefined;

	return (
		<div
			className={`player-avatar player-avatar--${faction?.toLowerCase() ?? "none"}`}
			title={`${player.nickname}${faction ? ` (${FactionLabels[faction]})` : ""}`}
			style={factionColor ? {
				borderColor: `#${factionColor.toString(16).padStart(6, "0")}`,
			} : undefined}
		>
			<Avatar
				src={player.avatar}
				size={28}
				userName={player.nickname}
			/>
			<div className={`player-avatar__dot player-avatar__dot--${dotState}`} />
		</div>
	);
};

/**
 * ShipStatusBar - 舰船状态条组件
 *
 * 显示：
 * - 船体值进度条 + 数值
 * - 辐能双色条（软蓝+硬粉） + 数值
 * - 坐标角度：(x, y) + heading°
 */
const ShipStatusBar: React.FC<{ ship: CombatToken }> = ({ ship }) => {
	const runtime = ship.runtime;
	const spec = ship.spec;

	const hull = runtime.hull ?? 0;
	const hullMax = spec.maxHitPoints ?? 100;
	const hullPct = Math.min(100, (hull / hullMax) * 100);

	const fluxSoft = runtime.fluxSoft ?? 0;
	const fluxHard = runtime.fluxHard ?? 0;
	const fluxTotal = fluxSoft + fluxHard;
	const fluxMax = spec.fluxCapacity ?? 100;
	const fluxSoftPct = fluxMax > 0 ? Math.min(100, (fluxSoft / fluxMax) * 100) : 0;
	const fluxHardPct = fluxMax > 0 ? Math.min(100, (fluxHard / fluxMax) * 100) : 0;

	const position = runtime.position ?? { x: 0, y: 0 };
	const heading = runtime.heading ?? 0;

	const displayName = runtime.displayName ?? ship.metadata?.name ?? ship.$id.slice(-6);
	const faction = runtime.faction;
	const factionColor = faction ? FactionColors[faction] : undefined;

	return (
		<div className="ship-status-bar">
			{/* 舰船标识 */}
			<div className="ship-status-bar__header">
				{factionColor && (
					<div
						className="ship-status-bar__faction-dot"
						style={{
							background: `#${factionColor.toString(16).padStart(6, "0")}`,
						}}
					/>
				)}
				<span className="ship-status-bar__name">{displayName}</span>
			</div>

			{/* 船体值 */}
			<div className="ship-status-bar__stat">
				<span className="ship-status-bar__stat-label">船体</span>
				<div className="ship-status-bar__stat-bar-container">
					<div className="ship-status-bar__stat-bar ship-status-bar__stat-bar--hull">
						<div
							className="ship-status-bar__stat-bar-fill"
							style={{
								width: `${hullPct}%`,
								background: hullPct > 50 ? "#2ecc71" : hullPct > 25 ? "#f1c40f" : "#e74c3c",
							}}
						/>
					</div>
					<span className="ship-status-bar__stat-value">{hull}/{hullMax}</span>
				</div>
			</div>

			{/* 辐能 */}
			<div className="ship-status-bar__stat">
				<span className="ship-status-bar__stat-label">辐能</span>
				<div className="ship-status-bar__stat-bar-container">
					<div className="ship-status-bar__stat-bar ship-status-bar__stat-bar--flux">
						<div
							className="ship-status-bar__stat-bar-fill ship-status-bar__stat-bar-fill--hard"
							style={{ width: `${fluxHardPct}%` }}
						/>
						<div
							className="ship-status-bar__stat-bar-fill ship-status-bar__stat-bar-fill--soft"
							style={{ width: `${fluxSoftPct}%`, left: `${fluxHardPct}%` }}
						/>
					</div>
					<span className="ship-status-bar__stat-value">{fluxTotal}/{fluxMax}</span>
				</div>
			</div>

			{/* 坐标角度 */}
			<div className="ship-status-bar__position">
				<span className="ship-status-bar__position-value">
					({Math.round(position.x)}, {Math.round(position.y)})
				</span>
				<span className="ship-status-bar__position-heading">
					{Math.round(heading)}°
				</span>
			</div>
		</div>
	);
};

export default TopBar;
