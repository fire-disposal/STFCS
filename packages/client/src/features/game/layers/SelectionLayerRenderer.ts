/**
 * 选中状态图层渲染器
 * 在独立图层上绘制所有 Token 的控制权限状态
 */

import { Container } from "pixi.js";
import type { TokenInfo } from "@vt/contracts/types";
import type { SelectionRecord } from "@/store/slices/selectionSlice";
import { createControlLock } from "@/features/game/components/TokenAddons";

/**
 * 选中状态图层配置
 */
export interface SelectionLayerConfig {
	/** 当前玩家 ID */
	currentPlayerId: string | null;
	/** 所有 Token 的选择状态（控制权限） */
	selections: Record<string, SelectionRecord>;
	/** 本地选中的 Token ID（用于高亮） */
	selectedTokenId: string | null;
	/** 所有 Token 数据 */
	tokens: Record<string, TokenInfo>;
	/** 缩放级别 */
	zoom: number;
}

/**
 * 渲染选中状态图层
 * 在独立图层上绘制所有选中状态，便于图层管理
 */
export function renderSelectionLayer(
	layer: Container,
	config: SelectionLayerConfig
): void {
	layer.removeChildren();

	const { selections, tokens, selectedTokenId, currentPlayerId, zoom } = config;

	// 收集所有被选中的 Token（拥有控制权限）
	const selectedTokens = new Map<string, SelectionRecord>();

	Object.entries(selections).forEach(([tokenId, selection]) => {
		if (selection.selectedBy) {
			selectedTokens.set(tokenId, selection);
		}
	});

	// 如果没有选中状态，直接返回
	if (selectedTokens.size === 0 && !selectedTokenId) {
		return;
	}

	// 渲染每个被选中的 Token
	selectedTokens.forEach((selection, tokenId) => {
		const token = tokens[tokenId];
		if (!token) return;

		// 创建 Token 位置的容器
		const tokenContainer = new Container();
		tokenContainer.position.set(token.position.x, token.position.y);

		// 判断是否是本地玩家控制的 Token
		const isControlledByLocal = selection.selectedBy?.id === currentPlayerId;
		
		// 绘制控制权限锁定标识
		// 如果是本地玩家选中但不是本地玩家控制（被其他玩家控制），显示控制者
		// 如果是本地玩家控制，也显示锁定框
		const shouldShowLock = selectedTokenId === tokenId || selection.selectedBy;
		
		if (shouldShowLock) {
			// 如果是本地选中的 Token，使用绿色；否则使用控制者的颜色
			const lockColor = isControlledByLocal ? 0x00ff88 : 0xffaa00;
			
			const lockHighlight = createControlLock(token, {
				color: lockColor,
				lineWidth: 2,
				alpha: 0.95,
				cornerSize: 24,
				cornerExtension: 10,
				showConnectLines: true,
				connectLineAlpha: 0.4,
				padding: 10,
				showPlayerName: !isControlledByLocal, // 只显示非本地玩家的控制者名称
				showDMBadge: true,
				nameFontSize: 11,
				nameBackgroundAlpha: 0.7,
				controller: selection.selectedBy ? {
					playerId: selection.selectedBy.id,
					playerName: selection.selectedBy.name,
					isDMMode: selection.selectedBy.isDMMode,
				} : null,
			}, zoom);
			tokenContainer.addChild(lockHighlight);
		}

		layer.addChild(tokenContainer);
	});
}

/**
 * 更新选中状态图层（高效更新）
 * 只更新变化的部分
 */
export function updateSelectionLayer(
	layer: Container,
	config: SelectionLayerConfig,
	prevConfig: SelectionLayerConfig | null
): void {
	// 如果配置没有变化，跳过更新
	if (
		prevConfig &&
		prevConfig.selectedTokenId === config.selectedTokenId &&
		prevConfig.currentPlayerId === config.currentPlayerId &&
		prevConfig.zoom === config.zoom &&
		JSON.stringify(prevConfig.selections) === JSON.stringify(config.selections)
	) {
		return;
	}

	// 完全重绘
	renderSelectionLayer(layer, config);
}
