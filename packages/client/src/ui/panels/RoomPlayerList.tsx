/**
 * RoomPlayerList - 房间内玩家列表组件
 * 显示：头像 + 用户名 + DM标记 + 准备状态
 *
 * 头像边框颜色规则：
 * - 红色：当前非本玩家回合
 * - 蓝色：当前玩家回合且未准备（PLAYER_ACTION/DEPLOYMENT，isReady=false）
 * - 绿色：当前玩家回合且已准备（PLAYER_ACTION/DEPLOYMENT，isReady=true）
 */

import React from "react";
import { Crown, CheckCircle, XCircle } from "lucide-react";
import { Avatar } from "@/ui/shared/Avatar";
import type { GamePhase } from "@vt/data";

interface PlayerInfo {
	sessionId: string;
	nickname: string;
	role: string;
	isReady: boolean;
	connected: boolean;
}

interface RoomPlayerListProps {
	players: Record<string, PlayerInfo>;
	currentPlayerId: string | null;
	phase?: GamePhase;
	maxVisible?: number;
	onPlayerClick?: (playerId: string) => void;
}

export const RoomPlayerList: React.FC<RoomPlayerListProps> = ({
	players,
	currentPlayerId,
	phase,
	maxVisible = 8,
	onPlayerClick,
}) => {
	const playerList = Object.values(players).filter(p => p.connected);

	if (playerList.length === 0) {
		return <div className="room-player-list room-player-list--empty">暂无玩家</div>;
	}

	const visiblePlayers = playerList.slice(0, maxVisible);
	const hiddenCount = playerList.length - maxVisible;

	const getBorderColor = (player: PlayerInfo): string => {
		const isCurrentPlayer = player.sessionId === currentPlayerId;

		if (phase === "PLAYER_ACTION" || phase === "DEPLOYMENT") {
			if (isCurrentPlayer) {
				return player.isReady ? "green" : "blue";
			}
			return "red";
		}

		return "gray";
	};

	return (
		<div className="room-player-list">
			{visiblePlayers.map((player) => {
				const borderColor = getBorderColor(player);
				return (
					<div
						key={player.sessionId}
						className={`room-player-item room-player-item--border-${borderColor}`}
						onClick={() => onPlayerClick?.(player.sessionId)}
					>
						<Avatar
							userName={player.nickname}
							size={28}
						/>
						<div className="room-player-info">
							<span className="room-player-name">
								{player.nickname}
							</span>
							{player.role === "HOST" && (
								<span className="room-player-badge room-player-badge--dm">
									<Crown size={10} />
								</span>
							)}
						</div>
						{(phase === "DEPLOYMENT" || phase === "PLAYER_ACTION") && (
							<div className={`room-player-status ${player.isReady ? "room-player-status--ready" : "room-player-status--not-ready"}`}>
								{player.isReady ? <CheckCircle size={12} /> : <XCircle size={12} />}
							</div>
						)}
					</div>
				);
			})}
			{hiddenCount > 0 && (
				<div className="room-player-item room-player-item--more">
					+{hiddenCount}
				</div>
			)}
		</div>
	);
};

export default RoomPlayerList;