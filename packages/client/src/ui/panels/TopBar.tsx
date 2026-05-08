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
import { GamePhase } from "@vt/data";
import type { RoomPlayerState, CombatToken } from "@vt/data";
import { Avatar } from "@/ui/shared/Avatar";
import { ShipStatusBar } from "./ShipStatusBar";
import { SaveMenu } from "./SaveMenu";
import { useUIStore } from "@/state/stores/uiStore";
import {
	useGamePhase,
	useGameTurnCount,
	useGameActiveFaction,
	useGamePlayers,
	useGameState,
	useAllTokens,
	useGamePlayerId,
} from "@/state/stores/gameStore";
import "./top-bar.css";

interface TopBarProps {
	onReadyToggle: () => void;
	onSettings: () => void;
	onLeave: () => void;
	onFactionChange?: (playerId: string, faction: string) => void;
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
	const gameState = useGameState();
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
					initiativeOrder={gameState?.initiativeOrder}
					factions={gameState?.factions as Record<string, { name: string; color: string }> | undefined}
				/>
			</div>

			<div className="top-bar__center">
				<PlayerAvatars players={players} phase={phase} activeFaction={activeFaction} initiativeOrder={gameState?.initiativeOrder ?? []} />
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
					factions={gameState?.factions as Record<string, { name: string; color: string }> ?? {}}
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
	currentFaction: string | undefined;
	currentPlayerId: string | null;
	factions: Record<string, { name: string; color: string }>;
	onFactionChange?: (playerId: string, faction: string) => void;
}> = ({ currentFaction, currentPlayerId, factions, onFactionChange }) => {
	const [open, setOpen] = useState(false);

	const handleSelect = useCallback((factionId: string) => {
		if (currentPlayerId && onFactionChange) {
			onFactionChange(currentPlayerId, factionId);
		}
		setOpen(false);
	}, [currentPlayerId, onFactionChange]);

	if (!currentPlayerId || !onFactionChange) return null;

	const factionOptions = Object.entries(factions);
	const currentDef = currentFaction ? factions[currentFaction] : undefined;

	return (
		<div className="top-bar__faction-selector" style={{ position: "relative" }}>
			<button
				className="top-bar__action-btn"
				onClick={() => setOpen(!open)}
				title={currentDef?.name ?? currentFaction ?? "选择派系"}
				style={{
					borderColor: currentDef?.color ?? undefined,
					borderWidth: 1,
					borderStyle: "solid",
				}}
			>
				<Flag size={16} />
				{currentDef?.name ?? currentFaction ?? "派系"}
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
					{factionOptions.map(([factionId, def]) => (
						<button
							key={factionId}
							className="top-bar__faction-option"
							onClick={() => handleSelect(factionId)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								width: "100%",
								padding: "6px 10px",
								background: currentFaction === factionId ? "rgba(74, 158, 255, 0.15)" : "transparent",
								border: "none",
								borderRadius: 4,
								color: "#cfe8ff",
								cursor: "pointer",
								fontSize: 12,
							}}
							onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(74, 158, 255, 0.1)")}
							onMouseLeave={(e) => (e.currentTarget.style.background = currentFaction === factionId ? "rgba(74, 158, 255, 0.15)" : "transparent")}
						>
							<span
								style={{
									width: 10,
									height: 10,
									borderRadius: "50%",
									background: def.color,
								}}
							/>
							{def.name}
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
	activeFaction: string | undefined;
	initiativeOrder: string[];
}> = ({ players, phase, activeFaction, initiativeOrder }) => {
	const grouped = useMemo(() => {
		const playerList = Object.values(players).filter((p) => p.connected);
		const result: { faction: string | undefined; players: RoomPlayerState[] }[] = [];

		for (const faction of initiativeOrder) {
			const factionPlayers = playerList
				.filter((p) => p.faction === faction)
				.sort((a, b) => a.nickname.localeCompare(b.nickname));
			if (factionPlayers.length > 0) {
				result.push({ faction, players: factionPlayers });
			}
		}

		const unaffiliated = playerList
			.filter((p) => !p.faction)
			.sort((a, b) => a.nickname.localeCompare(b.nickname));
		if (unaffiliated.length > 0) {
			result.push({ faction: undefined, players: unaffiliated });
		}

		return result;
	}, [players, initiativeOrder]);

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
	faction?: string;
	activeFaction: string | undefined;
}> = ({ player, phase, faction, activeFaction }) => {
	const getDotState = () => {
		if (phase !== "PLAYER_ACTION" && phase !== "FACTION_ACTION") return "default";
		if (activeFaction === player.faction) {
			return player.isReady ? "current-ready" : "current-not-ready";
		}
		return "other-turn";
	};

	const dotState = getDotState();

	const factionColor = faction ? (faction.includes("fate-grip") ? 0xff4a4a : faction.includes("player-alliance") ? 0x4a9eff : undefined) : undefined;

	return (
		<div
			className={`player-avatar player-avatar--${faction?.toLowerCase() ?? "none"}`}
			title={`${player.nickname}${faction ? ` (${faction})` : ""}`}
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

export default TopBar;
