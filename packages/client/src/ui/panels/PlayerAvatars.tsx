import React, { useMemo } from "react";
import type { RoomPlayerState } from "@vt/data";
import { GamePhase } from "@vt/data";
import { Avatar } from "@/ui/shared/Avatar";
import { useGameState } from "@/state/stores/gameStore";
import "./player-avatars.css";

/**
 * 单玩家头像 + 就绪状态指示器
 */
const PlayerAvatar: React.FC<{
	player: RoomPlayerState;
	phase: GamePhase;
	faction?: string;
	activeFaction: string | undefined;
}> = ({ player, phase, faction, activeFaction }) => {
	const factions = useGameState()?.factions;
	const getDotState = () => {
		if (phase !== GamePhase.FACTION_ACTION) return "default";
		if (activeFaction === player.faction) {
			return player.isReady ? "current-ready" : "current-not-ready";
		}
		return "other-turn";
	};

	const dotState = getDotState();
	const factionDef = faction ? factions?.[faction] : undefined;
	const factionColor = factionDef?.color ? parseInt(factionDef.color.replace("#", ""), 16) : undefined;

	return (
		<div
			className={`player-avatar player-avatar--${faction?.toLowerCase() ?? "none"}`}
			title={`${player.nickname}${faction ? ` (${faction})` : ""}`}
			style={factionColor ? { borderColor: `#${factionColor.toString(16).padStart(6, "0")}` } : undefined}
		>
			<Avatar src={player.avatar} size={28} userName={player.nickname} />
			<div className={`player-avatar__dot player-avatar__dot--${dotState}`} />
		</div>
	);
};

/**
 * 按派系分组的玩家头像行
 */
export const PlayerAvatars: React.FC<{
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
