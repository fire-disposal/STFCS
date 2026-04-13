/**
 * 图层控制面板组件
 * 提供图层可见性切换和视图模式选择
 */

import { LayerGroupId, ViewMode } from "@/features/game/layers/types";
import { useLayerManager } from "@/hooks/useLayerManager";
import { ChevronDown, ChevronRight, Eye, EyeOff, Layers } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

interface LayerControlPanelProps {
	className?: string;
	// GameView 传递的 props
	collapsed?: boolean;
	onToggle?: () => void;
}

export const LayerControlPanel: React.FC<LayerControlPanelProps> = ({ className }) => {
	const { t } = useTranslation();
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

	const renderViewModeButton = (mode: ViewMode, labelKey: string) => (
		<button
			className={`view-mode-button ${layerManager.currentViewMode === mode ? "active" : ""}`}
			onClick={() => layerManager.switchViewMode(mode)}
			title={layerManager.getCurrentViewModeConfig()?.description}
		>
			{t(labelKey)}
		</button>
	);

	return (
		<div className={`layer-control-panel ${className || ""}`}>
			<div className="layer-panel-header">
				<h3>
					<Layers size={16} />
					{t("layer.title")}
				</h3>
			</div>

			{/* 视图模式快速切换 */}
			<div className="view-mode-section">
				<div className="view-mode-buttons">
					{renderViewModeButton(ViewMode.TACTICAL, "layer.viewModes.tactical")}
					{renderViewModeButton(ViewMode.NAVIGATION, "layer.viewModes.navigation")}
					{renderViewModeButton(ViewMode.DECORATIVE, "layer.viewModes.decorative")}
				</div>
			</div>

			{/* 图层组列表 */}
			<div className="layer-groups">
				{groups.map((group) => (
					<div key={group.id} className="layer-group">
						<div className="layer-group-header" onClick={() => toggleGroup(group.id)}>
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
									layerManager.setGroupVisibility(group.id, !group.allVisible);
								}}
								title={group.allVisible ? t("layer.hideAll") : t("layer.showAll")}
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
											<button
												className="layer-toggle-button"
												onClick={() => layerManager.setLayerVisibility(layerId, !layer.visible)}
												title={layer.visible ? t("layer.hide") : t("layer.show")}
											>
												{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
											</button>
										</div>
									);
								})}
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
};
