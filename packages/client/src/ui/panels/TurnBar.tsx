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

	const activeDef = activeFaction ? factions?.[activeFaction] : undefined;

	return (
		<div className="turn-bar">
			<div className="turn-bar__round-badge">
				<span className="turn-bar__round-num">{turnCount}</span>
				<span className="turn-bar__round-label">轮</span>
			</div>

			{isSettlement && (
				<div className="turn-bar__settlement">
					<span className="turn-bar__settlement-icon">⚙</span>
					<span className="turn-bar__settlement-text">结算阶段</span>
				</div>
			)}

			{isActionPhase && initiativeOrder && initiativeOrder.length > 0 && (
				<div className="turn-bar__timeline">
					{initiativeOrder.map((fid, i) => {
						const def = factions?.[fid];
						const isActive = i === currentIndex;
						const isDone = i < currentIndex;
						const isPending = i > currentIndex;
						const isMine = fid === myFaction;
						const flagBg = def?.flagAssetId
							? `url(${textureManager.getTextureUrl(def.flagAssetId)}) center/cover`
							: def?.color ?? "#555";

						return (
							<React.Fragment key={fid}>
								{i > 0 && (
									<div className={`turn-bar__connector ${isDone ? "turn-bar__connector--done" : ""}`} />
								)}
								<div
									className={`turn-bar__faction ${isActive ? "turn-bar__faction--active" : ""} ${isDone ? "turn-bar__faction--done" : ""} ${isPending ? "turn-bar__faction--pending" : ""} ${isMine ? "turn-bar__faction--mine" : ""}`}
									title={def?.name ?? fid}
									style={isActive ? { "--faction-color": def?.color ?? "#4a9eff" } as React.CSSProperties : undefined}
								>
									<div className="turn-bar__faction-flag" style={{ background: flagBg }} >
										{!def?.flagAssetId && (
											<span className="turn-bar__faction-initial">{def?.name?.charAt(0) ?? "?"}</span>
										)}
										{isDone && <span className="turn-bar__faction-check">✓</span>}
									</div>
									<span className="turn-bar__faction-name">
										{def?.name ?? fid.split(":").pop()}
									</span>
									{isMine && <span className="turn-bar__faction-mine-dot" />}
								</div>
							</React.Fragment>
						);
					})}
				</div>
			)}

			{isActionPhase && activeDef && (
				<div className="turn-bar__active-label" style={{ color: activeDef.color }}>
					{activeDef.name} 行动中
				</div>
			)}

			{isMyTurn && (
				<button
					onClick={handleToggleReady}
					className={`turn-bar__ready ${isReady ? "turn-bar__ready--done" : ""}`}
				>
					{isReady ? "✓ 已就绪" : "● 就绪"}
				</button>
			)}
		</div>
	);
};

export default TurnBar;
