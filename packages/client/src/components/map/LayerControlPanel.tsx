/**
 * 图层控制面板组件
 * 提供图层可见性切换和视图模式选择
 */

import React, { useState } from "react";
import { useLayerManager } from "@/hooks/useLayerManager";
import { LayerId, LayerGroupId, ViewMode } from "@/features/game/layers/types";
import { Eye, EyeOff, Layers, ChevronDown, ChevronRight } from "lucide-react";

interface LayerControlPanelProps {
	className?: string;
}

export const LayerControlPanel: React.FC<LayerControlPanelProps> = ({
	className,
}) => {
	const layerManager = useLayerManager();
	const [expandedGroups, setExpandedGroups] = useState<Set<LayerGroupId>>(
		new Set([LayerGroupId.BACKGROUND])
	);

	const groups = layerManager.getAllGroups();

	const toggleGroup = (groupId: LayerGroupId) => {
		const newExpanded = new Set(expandedGroups);
		if (newExpanded.has(groupId)) {
			newExpanded.delete(groupId);
		} else {
			newExpanded.add(groupId);
		}
		setExpandedGroups(newExpanded);
	};

	const renderViewModeButton = (mode: ViewMode, label: string) => (
		<button
			className={`view-mode-button ${
				layerManager.currentViewMode === mode ? "active" : ""
			}`}
			onClick={() => layerManager.switchViewMode(mode)}
			title={layerManager.getCurrentViewModeConfig()?.description}
		>
			{label}
		</button>
	);

	return (
		<div className={`layer-control-panel ${className || ""}`}>
			<div className="layer-panel-header">
				<h3>
					<Layers size={16} />
					图层控制
				</h3>
			</div>

			{/* 视图模式快速切换 */}
			<div className="view-mode-section">
				<div className="view-mode-buttons">
					{renderViewModeButton(ViewMode.TACTICAL, "战术")}
					{renderViewModeButton(ViewMode.NAVIGATION, "航海")}
					{renderViewModeButton(ViewMode.DECORATIVE, "装饰")}
				</div>
			</div>

			{/* 图层组列表 */}
			<div className="layer-groups">
				{groups.map((group) => (
					<div key={group.id} className="layer-group">
						<div
							className="layer-group-header"
							onClick={() => toggleGroup(group.id)}
						>
							<span className="group-expand-icon">
								{expandedGroups.has(group.id) ? (
									<ChevronDown size={14} />
								) : (
									<ChevronRight size={14} />
								)}
							</span>
							<span className="group-name">{group.name}</span>
							<button
								className="group-toggle-button"
								onClick={(e) => {
									e.stopPropagation();
									layerManager.setGroupVisibility(
										group.id,
										!group.allVisible
									);
								}}
								title={group.allVisible ? "隐藏全部" : "显示全部"}
							>
								{group.allVisible ? (
									<Eye size={14} />
								) : group.someVisible ? (
									<EyeOff size={14} />
								) : (
									<EyeOff size={14} />
								)}
							</button>
						</div>

						{expandedGroups.has(group.id) && (
							<div className="layer-group-items">
								{group.layerIds.map((layerId) => {
									const layer = layerManager.getLayer(layerId);
									return (
										<div key={layerId} className="layer-item">
											<span className="layer-name">{layer.name}</span>
											<div className="layer-controls">
												<button
													className={`layer-toggle-button ${
														layer.visible ? "visible" : "hidden"
													}`}
													onClick={() =>
														layerManager.setLayerVisibility(
															layerId,
															!layer.visible
														)
													}
													title={layer.visible ? "隐藏" : "显示"}
												>
													{layer.visible ? (
														<Eye size={14} />
													) : (
														<EyeOff size={14} />
													)}
												</button>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				))}
			</div>

			<style>{`
				.layer-control-panel {
					padding: 12px;
					background: rgba(20, 20, 40, 0.7);
					border-radius: 4px;
				}

				.layer-panel-header {
					margin-bottom: 12px;
					padding-bottom: 8px;
					border-bottom: 1px solid rgba(74, 158, 255, 0.2);
				}

				.layer-panel-header h3 {
					display: flex;
					align-items: center;
					gap: 8px;
					color: #aaccff;
					font-size: 14px;
					margin: 0;
				}

				.view-mode-section {
					margin-bottom: 16px;
				}

				.view-mode-buttons {
					display: flex;
					gap: 6px;
				}

				.view-mode-button {
					flex: 1;
					padding: 6px 8px;
					background: rgba(40, 40, 80, 0.5);
					border: 1px solid rgba(74, 158, 255, 0.2);
					color: #8a9ebf;
					border-radius: 4px;
					font-size: 11px;
					cursor: pointer;
					transition: all 0.2s ease;
				}

				.view-mode-button:hover {
					background: rgba(60, 60, 100, 0.6);
					border-color: rgba(74, 158, 255, 0.4);
				}

				.view-mode-button.active {
					background: rgba(74, 158, 255, 0.2);
					border-color: #4a9eff;
					color: #aaccff;
				}

				.layer-groups {
					display: flex;
					flex-direction: column;
					gap: 8px;
				}

				.layer-group {
					background: rgba(30, 30, 60, 0.3);
					border-radius: 4px;
					overflow: hidden;
				}

				.layer-group-header {
					display: flex;
					align-items: center;
					gap: 6px;
					padding: 8px 10px;
					background: rgba(40, 40, 80, 0.4);
					cursor: pointer;
					transition: background 0.2s ease;
				}

				.layer-group-header:hover {
					background: rgba(50, 50, 100, 0.5);
				}

				.group-expand-icon {
					color: #6a7a9f;
					display: flex;
					align-items: center;
				}

				.group-name {
					flex: 1;
					color: #8a9ebf;
					font-size: 12px;
					font-weight: 500;
				}

				.group-toggle-button {
					padding: 4px;
					background: transparent;
					border: none;
					color: #6a7a9f;
					cursor: pointer;
					border-radius: 4px;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: all 0.2s ease;
				}

				.group-toggle-button:hover {
					background: rgba(74, 158, 255, 0.2);
					color: #4a9eff;
				}

				.layer-group-items {
					padding: 4px 8px 8px;
					display: flex;
					flex-direction: column;
					gap: 4px;
				}

				.layer-item {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 6px 10px;
					background: rgba(20, 20, 40, 0.5);
					border-radius: 4px;
					gap: 8px;
				}

				.layer-name {
					flex: 1;
					color: #6a7a9f;
					font-size: 11px;
				}

				.layer-controls {
					display: flex;
					gap: 4px;
					align-items: center;
				}

				.layer-toggle-button {
					padding: 4px;
					background: transparent;
					border: none;
					cursor: pointer;
					border-radius: 4px;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: all 0.2s ease;
				}

				.layer-toggle-button.visible {
					color: #4a9eff;
				}

				.layer-toggle-button.hidden {
					color: #4a5a7f;
				}

				.layer-toggle-button:hover {
					background: rgba(74, 158, 255, 0.2);
				}
			`}</style>
		</div>
	);
};
