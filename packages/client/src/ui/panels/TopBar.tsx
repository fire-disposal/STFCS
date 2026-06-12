/**
 * TopBar - 游戏顶栏组件
 *
 * 布局：
 * 左侧：回合条（紧凑）
 * 中部：玩家头像（按阵营分组）
 * 中右侧：选中舰船状态条（新增）
 * 右侧：派系选择、存档、设置、退出按钮
 */

import React from "react";
import { Settings, LogOut, Check } from "lucide-react";
import TurnBar from "./TurnBar";
import { ShipStatusBar } from "./ShipStatusBar";
import { FactionSelector } from "./FactionSelector";

import { SaveMenu } from "./SaveMenu";
import { useUIStore } from "@/state/stores/uiStore";
import { useGameAction } from "@/hooks/useGameAction";
import { GamePhase } from "@vt/data";
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
	onSettings: () => void;
	onLeave: () => void;
	onFactionChange?: (playerId: string, faction: string) => void;
	onFactionDelete?: (factionId: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
	onSettings,
	onLeave,
	onFactionChange,
	onFactionDelete,
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
	const inRoom = true;
	const { send } = useGameAction();
	const isMyTurn = phase === GamePhase.FACTION_ACTION && activeFaction && currentFaction === activeFaction;
	const isReady = currentPlayer?.isReady ?? false;

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
					initiativeOrder={gameState?.initiativeOrder}
					factions={gameState?.factions as Record<string, { name: string; color: string }> | undefined}
				/>
			</div>



			{/* 舰船状态条 */}
			{selectedShip && selectedShip.runtime && (
				<div className="top-bar__ship-status">
					<ShipStatusBar ship={selectedShip} />
				</div>
			)}

			<div className="top-bar__right">
				{isMyTurn && (
					<button
						className={`top-bar__action-btn ${isReady ? "top-bar__action-btn--ready" : ""}`}
						onClick={() => void send("room:action", { action: "ready" })}
					>
						<Check size={14} />
						{isReady ? "已就绪" : "就绪"}
					</button>
				)}
			<FactionSelector
				currentFaction={currentFaction}
				currentPlayerId={playerId}
				factions={gameState?.factions as Record<string, { name: string; color: string; flagAssetId?: string; ownerId?: string; ownerName?: string }> ?? {}}
				onFactionChange={onFactionChange}
				onFactionDelete={onFactionDelete}
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

export default TopBar;
