import React from "react";
import { GamePhase } from "@vt/data";
import { textureManager } from "@/renderer/systems/TextureManager";
import { useGameAction } from "@/hooks/useGameAction";
import {
	useGamePlayers,
	useGamePlayerId,
} from "@/state/stores/gameStore";
import "./turn-bar.css";

interface TurnBarProps {
	phase: GamePhase;
	turnCount: number;
	activeFaction: string | undefined;
	initiativeOrder?: string[];
	factions?: Record<string, { name: string; color: string; flagAssetId?: string }>;
}

export const TurnBar: React.FC<TurnBarProps> = ({
	phase,
	turnCount,
	activeFaction,
	initiativeOrder,
	factions,
}) => {
	const { send } = useGameAction();
	const playerId = useGamePlayerId();
	const players = useGamePlayers();
	const isActionPhase = phase === GamePhase.FACTION_ACTION;
	const isSettlement = phase === GamePhase.SETTLEMENT;
	const currentIndex = isActionPhase && activeFaction && initiativeOrder
		? initiativeOrder.indexOf(activeFaction)
		: -1;

	const currentPlayer = playerId ? players[playerId] : undefined;
	const myFaction = currentPlayer?.faction;
	const isMyTurn = isActionPhase && activeFaction && myFaction === activeFaction;
	const isReady = currentPlayer?.isReady ?? false;

	const handleToggleReady = async () => {
		await send("room:action", { action: "ready" });
	};

	const playerList = Object.entries(players);

	return (
		<div className="turn-bar">
			<div className="turn-bar__round">{turnCount}</div>

			{isSettlement && <div className="turn-bar__settlement">结算</div>}

			{isActionPhase && initiativeOrder && initiativeOrder.length > 0 && (
				<div className="turn-bar__groups">
					{initiativeOrder.map((fid, i) => {
						const def = factions?.[fid];
						const isActive = i === currentIndex;
						const isDone = i < currentIndex;
						const flagBg = def?.flagAssetId
							? `url(${textureManager.getTextureUrl(def.flagAssetId)}) center/cover`
							: def?.color ?? "#555";

						const factionPlayers = playerList.filter(
							([, p]) => p?.connected && p?.faction === fid
						);

						return (
							<React.Fragment key={fid}>
								{i > 0 && <div className="turn-bar__sep" />}
								<div
									className={`turn-bar__group${isActive ? " turn-bar__group--active" : ""}${isDone ? " turn-bar__group--done" : ""}`}
									style={{ "--fc": def?.color ?? "#4a9eff" } as React.CSSProperties}
								>
									<div className="turn-bar__flag" style={{ background: flagBg }}>
										{!def?.flagAssetId && <span>{def?.name?.charAt(0) ?? "?"}</span>}
									</div>
									{factionPlayers.map(([pid, p]) => (
										<div
											key={pid}
											className={`turn-bar__avatar${p?.isReady ? " turn-bar__avatar--ready" : ""}`}
											title={p?.nickname ?? pid}
										>
											{p?.nickname?.charAt(0) ?? "?"}
										</div>
									))}
									{isDone && <span className="turn-bar__done-mark">✓</span>}
								</div>
							</React.Fragment>
						);
					})}
				</div>
			)}

			{isMyTurn && (
				<button onClick={handleToggleReady} className={`turn-bar__ready${isReady ? " turn-bar__ready--active" : ""}`}>
					{isReady ? "✓" : "●"}
				</button>
			)}
		</div>
	);
};

export default TurnBar;
