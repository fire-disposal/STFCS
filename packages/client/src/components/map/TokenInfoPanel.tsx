import { useAppSelector } from "@/store";
import { updateToken } from "@/store/slices/mapSlice";
import type { TokenInfo } from "@vt/shared/types";
import React from "react";
import { useTranslation } from "react-i18next";
import { Rocket, Satellite, MapPin, RotateCcw, RotateCw, Check, Zap, SkipForward } from "lucide-react";
import { useDispatch } from "react-redux";

interface TokenInfoPanelProps {
	className?: string;
}

const TokenInfoPanel: React.FC<TokenInfoPanelProps> = ({ className }) => {
	const dispatch = useDispatch();
	const { t } = useTranslation();
	const { tokens, selectedTokenId } = useAppSelector((state) => state.map);
	const selectedToken = selectedTokenId ? tokens[selectedTokenId] : null;

	if (!selectedToken) {
		return (
			<div className={`token-info-panel ${className || ""}`}>
				<div className="token-info-placeholder">
					<h3>{t("token.info")}</h3>
					<p className="placeholder-text">{t("token.noSelection")}</p>
					<p className="placeholder-hint">{t("token.clickToSelect")}</p>
				</div>
			</div>
		);
	}

	const token = selectedToken;

	// 获取元数据
	const metadata = token.metadata || {};
	const faction = (metadata.faction as string) || "neutral";
	const tokenClass = (metadata.class as string) || (metadata.type as string) || "unknown";
	const composition = (metadata.composition as string) || "unknown";

	// 计算移动百分比
	const movementPercent =
		token.maxMovement > 0 ? Math.round((token.remainingMovement / token.maxMovement) * 100) : 0;

	// 计算行动百分比
	const actionsPercent =
		token.actionsPerTurn > 0
			? Math.round((token.remainingActions / token.actionsPerTurn) * 100)
			: 0;

	// 处理旋转操作
	const handleRotate = (direction: "left" | "right") => {
		const angle = direction === "left" ? -15 : 15;
		const newHeading = (token.heading + angle) % 360;

		dispatch(
			updateToken({
				id: token.id,
				updates: { heading: newHeading },
			})
		);
	};

	// 处理结束回合
	const handleEndTurn = () => {
		// 重置移动和行动点
		dispatch(
			updateToken({
				id: token.id,
				updates: {
					remainingMovement: token.maxMovement,
					remainingActions: token.actionsPerTurn,
					turnState: "ended",
				},
			})
		);
	};

	// 处理标记为已移动
	const handleMarkMoved = () => {
		dispatch(
			updateToken({
				id: token.id,
				updates: {
					turnState: "moved",
					remainingMovement: 0,
				},
			})
		);
	};

	// 处理标记为已行动
	const handleMarkActed = () => {
		dispatch(
			updateToken({
				id: token.id,
				updates: {
					turnState: "acted",
					remainingActions: Math.max(0, token.remainingActions - 1),
				},
			})
		);
	};

	// 获取回合状态颜色
	const getTurnStateColor = (state: TokenInfo["turnState"]) => {
		switch (state) {
			case "active":
				return "#4ade80";
			case "moved":
				return "#fbbf24";
			case "acted":
				return "#ef4444";
			case "ended":
				return "#6b7280";
			case "waiting":
			default:
				return "#8a8aa8";
		}
	};

	// 获取token类型图标
	const getTokenTypeIcon = (type: TokenInfo["type"]) => {
		switch (type) {
			case "ship":
				return <Rocket size={18} />;
			case "station":
				return <Satellite size={18} />;
			case "asteroid":
				return <MapPin size={18} />;
			default:
				return <MapPin size={18} />;
		}
	};

	return (
		<div className={`token-info-panel ${className || ""}`}>
			<div className="token-info-header">
				<div className="token-icon-title">
					<span className="token-icon">{getTokenTypeIcon(token.type)}</span>
					<div className="token-title">
						<h3>{tokenClass.toUpperCase()}</h3>
						<div className="token-subtitle">
							<span className="token-id">{t("token.id")}: {token.id.slice(0, 8)}</span>
							<span className="token-type">{t("token.type.ship")}: {token.type}</span>
						</div>
					</div>
				</div>
				<div className="token-status">
					<span
						className="turn-state-indicator"
						style={{ backgroundColor: getTurnStateColor(token.turnState) }}
					/>
					<span className="turn-state-label">{token.turnState.toUpperCase()}</span>
				</div>
			</div>

			<div className="token-info-content">
				{/* 基本信息 */}
				<div className="info-section">
					<h4>{t("token.basicInfo")}</h4>
					<div className="info-grid">
						<div className="info-item">
							<span className="info-label">{t("token.position")}</span>
							<span className="info-value">
								{Math.round(token.position.x)}, {Math.round(token.position.y)}
							</span>
						</div>
						<div className="info-item">
							<span className="info-label">{t("token.heading")}</span>
							<span className="info-value">{Math.round(token.heading)}°</span>
						</div>
						<div className="info-item">
							<span className="info-label">{t("token.size")}</span>
							<span className="info-value">{token.size} units</span>
						</div>
						<div className="info-item">
							<span className="info-label">{t("token.scale")}</span>
							<span className="info-value">{token.scale}x</span>
						</div>
						<div className="info-item">
							<span className="info-label">{t("token.layer")}</span>
							<span className="info-value">{token.layer}</span>
						</div>
						<div className="info-item">
							<span className="info-label">{t("token.collision")}</span>
							<span className="info-value">{token.collisionRadius} units</span>
						</div>
					</div>
				</div>

				{/* 回合状态 */}
				<div className="info-section">
					<h4>{t("token.turnStatus")}</h4>
					<div className="resource-bars">
						{token.maxMovement > 0 && (
							<div className="resource-bar">
								<div className="bar-header">
									<span className="bar-label">{t("token.movementPoints")}</span>
									<span className="bar-value">
										{token.remainingMovement} / {token.maxMovement}
									</span>
								</div>
								<div className="bar-container">
									<div
										className="bar-fill movement-fill"
										style={{ width: `${movementPercent}%` }}
									/>
								</div>
							</div>
						)}
						{token.actionsPerTurn > 0 && (
							<div className="resource-bar">
								<div className="bar-header">
									<span className="bar-label">{t("token.actionPoints")}</span>
									<span className="bar-value">
										{token.remainingActions} / {token.actionsPerTurn}
									</span>
								</div>
								<div className="bar-container">
									<div className="bar-fill action-fill" style={{ width: `${actionsPercent}%` }} />
								</div>
							</div>
						)}
					</div>
				</div>

				{/* 元数据 */}
				{Object.keys(metadata).length > 0 && (
					<div className="info-section">
						<h4>{t("token.metadata")}</h4>
						<div className="metadata-grid">
							{faction && typeof faction === "string" && (
								<div className="metadata-item">
									<span className="metadata-label">{t("token.faction")}</span>
									<span className="metadata-value">{faction}</span>
								</div>
							)}
							{tokenClass && typeof tokenClass === "string" && (
								<div className="metadata-item">
									<span className="metadata-label">{t("token.class")}</span>
									<span className="metadata-value">{tokenClass}</span>
								</div>
							)}
							{composition && typeof composition === "string" && (
								<div className="metadata-item">
									<span className="metadata-label">{t("token.composition")}</span>
									<span className="metadata-value">{composition}</span>
								</div>
							)}
							{Object.entries(metadata)
								.filter(([key]) => !["faction", "class", "type", "composition"].includes(key))
								.map(([key, value]) => (
									<div key={key} className="metadata-item">
										<span className="metadata-label">{key.replace(/_/g, " ")}</span>
										<span className="metadata-value">{String(value)}</span>
									</div>
								))}
						</div>
					</div>
				)}

				{/* 操作按钮 */}
				<div className="info-section">
					<h4>{t("token.actions")}</h4>
					<div className="action-buttons">
						<div className="button-row">
							<button
								className="action-button rotate-left"
								onClick={() => handleRotate("left")}
								disabled={token.turnState === "acted"}
							>
								<span className="button-icon"><RotateCcw size={16} /></span>
								<span className="button-text">{t("token.rotateLeft")}</span>
							</button>
							<button
								className="action-button rotate-right"
								onClick={() => handleRotate("right")}
								disabled={token.turnState === "acted"}
							>
								<span className="button-icon"><RotateCw size={16} /></span>
								<span className="button-text">{t("token.rotateRight")}</span>
							</button>
						</div>
						<div className="button-row">
							<button
								className="action-button mark-moved"
								onClick={handleMarkMoved}
								disabled={token.turnState === "acted" || token.remainingMovement === 0}
							>
								<span className="button-icon"><Check size={16} /></span>
								<span className="button-text">{t("token.markMoved")}</span>
							</button>
							<button
								className="action-button mark-acted"
								onClick={handleMarkActed}
								disabled={token.turnState === "acted" || token.remainingActions === 0}
							>
								<span className="button-icon"><Zap size={16} /></span>
								<span className="button-text">{t("token.markActed")}</span>
							</button>
						</div>
						<div className="button-row">
							<button
								className="action-button end-turn"
								onClick={handleEndTurn}
								disabled={token.turnState === "waiting" || token.turnState === "ended"}
							>
								<span className="button-icon"><SkipForward size={16} /></span>
								<span className="button-text">{t("token.endTurn")}</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TokenInfoPanel;
