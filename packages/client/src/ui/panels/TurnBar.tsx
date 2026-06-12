import React from "react";
import { GamePhase } from "@vt/data";
import { textureManager } from "@/renderer/systems/TextureManager";
import { Avatar } from "@/ui/shared/Avatar";
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
	const playerId = useGamePlayerId();
	const players = useGamePlayers();
	const isActionPhase = phase === GamePhase.FACTION_ACTION;
	const isSettlement = phase === GamePhase.SETTLEMENT;
	const currentIndex = isActionPhase && activeFaction && initiativeOrder
		? initiativeOrder.indexOf(activeFaction)
		: -1;

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
									<div className="turn-bar__avatars">
										{factionPlayers.map(([pid, p]) => {
											const dotClass = isActive
												? (p?.isReady ? "turn-bar__dot--ready" : "turn-bar__dot--not-ready")
												: "turn-bar__dot--other";
											return (
												<div key={pid} className="turn-bar__avatar" title={p?.nickname ?? pid}>
													<Avatar src={p?.avatar} size={24} userName={p?.nickname ?? "?"} />
													<span className={`turn-bar__dot ${dotClass}`} />
												</div>
											);
										})}
									</div>
									{isDone && <span className="turn-bar__done-mark">✓</span>}
								</div>
							</React.Fragment>
						);
					})}
				</div>
			)}


		</div>
	);
};

export default TurnBar;
