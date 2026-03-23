import { useTranslation } from "react-i18next";
import { TopBarMenu } from "@/components/ui/TopBarMenu";
import GameCanvas from "@/components/map/GameCanvas";
import React, { useMemo } from "react";
import { useAppSelector } from "@/store";

interface GameViewProps {
	onDisconnect: () => void;
}

/**
 * 战略收缩版游戏视图
 * 仅保留：联机连接状态、玩家信息、可操作 Token 画布
 */
const GameView: React.FC<GameViewProps> = ({ onDisconnect }) => {
	const { t } = useTranslation();
	const camera = useAppSelector((state) => state.camera.local);
	const { currentPlayerId, players, roomId } = useAppSelector((state) => state.player);
	const { tokens, selectedTokenId } = useAppSelector((state) => state.map);

	const currentPlayer = currentPlayerId ? players[currentPlayerId] : null;
	const currentPlayerName = currentPlayer?.name || "Player";

	const controllableTokens = useMemo(
		() => Object.values(tokens).filter((token) => token.ownerId === currentPlayerId),
		[tokens, currentPlayerId]
	);

	const selectedToken = selectedTokenId ? tokens[selectedTokenId] : null;

	const handleZoomIn = () => {
		window.dispatchEvent(new CustomEvent("game-zoom", { detail: { action: "in" } }));
	};

	const handleZoomOut = () => {
		window.dispatchEvent(new CustomEvent("game-zoom", { detail: { action: "out" } }));
	};

	const handleResetZoom = () => {
		window.dispatchEvent(new CustomEvent("game-zoom", { detail: { action: "reset" } }));
	};

	return (
		<div className="game-view-minimal">
			<TopBarMenu
				onDisconnect={onDisconnect}
				playerName={currentPlayerName}
				zoom={camera.zoom}
				minZoom={camera.minZoom}
				maxZoom={camera.maxZoom}
				onZoomIn={handleZoomIn}
				onZoomOut={handleZoomOut}
				onReset={handleResetZoom}
			/>

			<main className="game-main-minimal">
				<GameCanvas />
				<div className="minimal-hud">
					<h3>{t("room.title")}</h3>
					<p>{t("room.roomId")}: {roomId || t("room.notJoined")}</p>
					<p>{t("room.players")}: {Object.keys(players).length}</p>
					<p>{t("token.controlHint", "拖拽你的 Token 并松手以同步到服务器")}</p>

					<hr />
					<strong>{t("token.myTokens", "我的可控Token")}: {controllableTokens.length}</strong>
					{selectedToken ? (
						<p>
							{t("token.selected", "当前选中")}: {selectedToken.id}
						</p>
					) : (
						<p>{t("token.noSelection", "未选中Token")}</p>
					)}
				</div>
			</main>

			<style>{`
				.game-view-minimal {
					width: 100%;
					height: 100%;
					display: flex;
					flex-direction: column;
					overflow: hidden;
					padding-top: 48px;
				}

				.game-main-minimal {
					position: relative;
					flex: 1;
				}

				.minimal-hud {
					position: absolute;
					right: 12px;
					top: 12px;
					z-index: 10;
					width: 280px;
					padding: 12px;
					border-radius: 8px;
					background: rgba(14, 19, 36, 0.82);
					border: 1px solid rgba(120, 170, 255, 0.35);
					color: #d8e4ff;
					font-size: 12px;
					line-height: 1.5;
				}

				.minimal-hud h3 {
					margin: 0 0 8px;
					font-size: 14px;
				}

				.minimal-hud p {
					margin: 6px 0;
				}
			`}</style>
		</div>
	);
};

export default GameView;
