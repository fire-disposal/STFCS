/**
 * TopBar - 游戏顶栏组件
 * 
 * 布局：
 * 左侧：回合条（紧凑）
 * 中部：玩家头像（按阵营分组）
 * 右侧：存档、设置、退出按钮
 */

import React from "react";
import { Settings, LogOut } from "lucide-react";
import TurnBar from "./TurnBar";
import { GamePhase, Faction } from "@vt/data";
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
}) => {
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
				<PlayerAvatars players={players} currentPlayerId={currentPlayerId} phase={phase} />
			</div>

			<div className="top-bar__right">
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

const PlayerAvatars: React.FC<{
	players: Record<string, RoomPlayerState>;
	currentPlayerId: string | null;
	phase: GamePhase;
}> = ({ players, currentPlayerId, phase }) => {
	const playerList = Object.values(players).filter((p) => p.connected);
	const grouped = {
		PLAYER: playerList.filter((p) => p.faction === "PLAYER" || !p.faction),
		ENEMY: playerList.filter((p) => p.faction === "ENEMY"),
		NEUTRAL: playerList.filter((p) => p.faction === "NEUTRAL"),
	};

	return (
		<div className="top-bar__avatars">
			{(["PLAYER", "ENEMY", "NEUTRAL"] as const).map((faction) => {
				const factionPlayers = grouped[faction];
				if (factionPlayers.length === 0) return null;

				return (
					<div key={faction} className="top-bar__avatar-group">
						{factionPlayers.map((player) => (
							<PlayerAvatar
								key={player.sessionId}
								player={player}
								phase={phase}
							/>
						))}
					</div>
				);
			})}
		</div>
	);
};

const PlayerAvatar: React.FC<{
	player: RoomPlayerState;
	phase: GamePhase;
}> = ({ player, phase }) => {
	const getBorderColor = () => {
		if (phase === "DEPLOYMENT" || phase === "PLAYER_ACTION") {
			if (player.faction === "PLAYER" || !player.faction) {
				return player.isReady ? "ready" : "waiting";
			}
		}
		if (phase === "DM_ACTION" && player.faction === "ENEMY") {
			return "active";
		}
		return "waiting";
	};

	return (
		<div className={`player-avatar player-avatar--${getBorderColor()}`} title={player.nickname}>
			<Avatar
				src={player.avatar}
				size={28}
				userName={player.nickname}
			/>
			{(phase === "DEPLOYMENT" || phase === "PLAYER_ACTION") && player.faction !== "ENEMY" && (
				<div className={`player-avatar__dot ${player.isReady ? "" : "player-avatar__dot--not-ready"}`} />
			)}
		</div>
	);
};

export default TopBar;