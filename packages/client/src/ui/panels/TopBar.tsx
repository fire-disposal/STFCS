/**
 * TopBar - 游戏顶栏组件
 *
 * 布局：
 * 左侧：回合条（紧凑）
 * 中部：玩家头像（按阵营分组）
 * 右侧：派系选择、存档、设置、退出按钮
 */

import React, { useState, useCallback, useMemo } from "react";
import { Settings, LogOut, Flag } from "lucide-react";
import TurnBar from "./TurnBar";
import { GamePhase, Faction, FactionColors, FactionLabels, TURN_ORDER } from "@vt/data";
import type { RoomPlayerState } from "@vt/data";
import { Avatar } from "@/ui/shared/Avatar";
import { SaveMenu } from "./SaveMenu";
import "./top-bar.css";

interface TopBarProps {
	phase: GamePhase;
	turnCount: number;
	activeFaction: Faction | undefined;
	players: Record<string, RoomPlayerState>;
	currentPlayerId: string | null;
	isHost: boolean;
	isReady: boolean;
	inRoom: boolean;
	onReadyToggle: () => void;
	onAdvancePhase: () => void;
	onSettings: () => void;
	onLeave: () => void;
	onFactionChange?: (playerId: string, faction: Faction) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
	phase,
	turnCount,
	activeFaction,
	players,
	currentPlayerId,
	isHost,
	isReady,
	inRoom,
	onReadyToggle,
	onAdvancePhase,
	onSettings,
	onLeave,
	onFactionChange,
}) => {
	const currentPlayer = currentPlayerId ? players[currentPlayerId] : undefined;
	const currentFaction = currentPlayer?.faction;

	return (
		<div className="top-bar">
			<div className="top-bar__left">
				<TurnBar
					phase={phase}
					turnCount={turnCount}
					activeFaction={activeFaction}
					players={players}
					currentPlayerId={currentPlayerId}
					isHost={isHost}
					isReady={isReady}
					onReadyToggle={onReadyToggle}
					onAdvancePhase={onAdvancePhase}
				/>
			</div>

			<div className="top-bar__center">
				<PlayerAvatars players={players} phase={phase} activeFaction={activeFaction} />
			</div>

			<div className="top-bar__right">
				{/* 派系选择器 */}
				<FactionSelector
					currentFaction={currentFaction}
					currentPlayerId={currentPlayerId}
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

export default TopBar;
