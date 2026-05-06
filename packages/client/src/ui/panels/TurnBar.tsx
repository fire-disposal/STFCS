/**
 * TurnBar - 回合指示条（简洁版）
 *
 * 显示：阶段 | 轮次 | 当前派系 | 进度条 | 准备按钮
 */

import React, { useMemo } from "react";
import { CheckCircle } from "lucide-react";
import { GamePhase, Faction, FactionLabels, TURN_ORDER } from "@vt/data";
import type { RoomPlayerState, CombatToken } from "@vt/data";
import "./turn-bar.css";

interface TurnBarProps {
	phase: string;
	turnCount: number;
	activeFaction: Faction | undefined;
	players: Record<string, RoomPlayerState>;
	tokens?: CombatToken[];
	currentFaction?: Faction | undefined;
	isReady: boolean;
	onReadyToggle: () => void;
}

const PHASE_LABELS: Record<string, string> = {
	DEPLOYMENT: "部署",
	PLAYER_ACTION: "行动",
};

const FACTION_SHORT: Record<string, string> = {
	PLAYER_ALLIANCE: "联",
	FATE_GRIP: "命",
};

export const TurnBar: React.FC<TurnBarProps> = ({
	phase,
	turnCount,
	activeFaction,
	players,
	tokens,
	currentFaction,
	isReady,
	onReadyToggle,
}) => {
	const factionTrackItems = useMemo(() => {
		if (phase !== GamePhase.PLAYER_ACTION || !activeFaction) return [];
		const currentIndex = TURN_ORDER.indexOf(activeFaction);
		return TURN_ORDER.map((faction, index) => ({
			faction,
			status: index < currentIndex ? "done" : index === currentIndex ? "active" : "pending",
			label: FACTION_SHORT[faction] ?? faction.slice(0, 1),
		}));
	}, [phase, activeFaction]);

	const readyCount = useMemo(() => 
		Object.values(players).filter((p) => p.connected && p.isReady).length,
		[players]
	);

	const totalPlayers = useMemo(() => 
		Object.values(players).filter((p) => p.connected).length,
		[players]
	);

	const shipCount = useMemo(() => {
		if (phase !== GamePhase.PLAYER_ACTION || !activeFaction || !tokens) return 0;
		return tokens.filter((t) => 
			t.runtime?.faction === activeFaction && 
			!t.runtime?.destroyed &&
			t.runtime?.position
		).length;
	}, [phase, activeFaction, tokens]);

	const isMyTurn = phase === GamePhase.PLAYER_ACTION && activeFaction === currentFaction;

	return (
		<div className="turn-bar">
			<div className={`turn-bar__phase turn-bar__phase--${phase.toLowerCase()}`}>
				{PHASE_LABELS[phase]}
			</div>

			{phase === GamePhase.PLAYER_ACTION && (
				<div className="turn-bar__turn">轮{turnCount}</div>
			)}

			{phase === GamePhase.DEPLOYMENT ? (
				<div className="turn-bar__info">
					<span className="turn-bar__ready">{readyCount}</span>
					<span className="turn-bar__slash">/</span>
					<span className="turn-bar__total">{totalPlayers}</span>
				</div>
			) : activeFaction && (
				<div className={`turn-bar__faction turn-bar__faction--${activeFaction.toLowerCase()}`}>
					<span>{FactionLabels[activeFaction]}</span>
					<span className="turn-bar__ships">{shipCount}舰</span>
				</div>
			)}

			{factionTrackItems.length > 0 && (
				<div className="turn-bar__track">
					{factionTrackItems.map((item, i) => (
						<React.Fragment key={item.faction}>
							<span className={`turn-bar__dot turn-bar__dot--${item.status} turn-bar__dot--${item.faction.toLowerCase()}`}>
								{item.status === "done" ? <CheckCircle size={10} /> : item.label}
							</span>
							{i < factionTrackItems.length - 1 && <span className="turn-bar__arrow">→</span>}
						</React.Fragment>
					))}
				</div>
			)}

			<button
				className={`turn-bar__btn ${isMyTurn ? "turn-bar__btn--active" : ""}`}
				onClick={onReadyToggle}
			>
				<CheckCircle size={12} />
				{phase === GamePhase.DEPLOYMENT ? (isReady ? "就绪" : "准备") : (isReady ? "完毕" : "操作中")}
			</button>
		</div>
	);
};

export default TurnBar;