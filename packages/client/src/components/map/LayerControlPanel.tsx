import { useUIStore } from "@/store/uiStore";
import { ChevronDown, ChevronRight, Eye, EyeOff, Layers, Monitor, Navigation2, Palette } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

interface LayerControlPanelProps {
	className?: string;
}

type ViewPreset = "tactical" | "navigation" | "decorative";

export const LayerControlPanel: React.FC<LayerControlPanelProps> = ({ className }) => {
	const { t } = useTranslation();
	const {
		showGrid,
		showBackground,
		showWeaponArcs,
		showMovementRange,
		toggleGrid,
		toggleBackground,
		toggleWeaponArcs,
		toggleMovementRange,
	} = useUIStore();

	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["background"]));
	const [currentPreset, setCurrentPreset] = useState<ViewPreset>("tactical");

	const groups = [
		{
			id: "background",
			name: "背景",
			layers: [
				{ id: "stars", name: "星空", visible: showBackground, toggle: toggleBackground },
				{ id: "grid", name: "网格", visible: showGrid, toggle: toggleGrid },
			],
		},
		{
			id: "objects",
			name: "游戏对象",
			layers: [
				{ id: "weaponArcs", name: "武器弧", visible: showWeaponArcs, toggle: toggleWeaponArcs },
				{ id: "movementRange", name: "移动范围", visible: showMovementRange, toggle: toggleMovementRange },
			],
		},
	];

	const presets: { id: ViewPreset; name: string; icon: React.ReactNode; config: { showGrid: boolean; showBackground: boolean; showWeaponArcs: boolean; showMovementRange: boolean } }[] = [
		{
			id: "tactical",
			name: "战术",
			icon: <Monitor size={14} />,
			config: { showGrid: true, showBackground: true, showWeaponArcs: true, showMovementRange: true },
		},
		{
			id: "navigation",
			name: "航海",
			icon: <Navigation2 size={14} />,
			config: { showGrid: true, showBackground: false, showWeaponArcs: false, showMovementRange: true },
		},
		{
			id: "decorative",
			name: "装饰",
			icon: <Palette size={14} />,
			config: { showGrid: false, showBackground: true, showWeaponArcs: false, showMovementRange: false },
		},
	];

	const applyPreset = (preset: ViewPreset) => {
		const config = presets.find((p) => p.id === preset)?.config;
		if (!config) return;

		const state = useUIStore.getState();
		if (state.showGrid !== config.showGrid) toggleGrid();
		if (state.showBackground !== config.showBackground) toggleBackground();
		if (state.showWeaponArcs !== config.showWeaponArcs) toggleWeaponArcs();
		if (state.showMovementRange !== config.showMovementRange) toggleMovementRange();

		setCurrentPreset(preset);
	};

	const toggleGroup = (groupId: string) => {
		const newExpanded = new Set(expandedGroups);
		if (newExpanded.has(groupId)) {
			newExpanded.delete(groupId);
		} else {
			newExpanded.add(groupId);
		}
		setExpandedGroups(newExpanded);
	};

	const toggleAllInGroup = (groupId: string) => {
		const group = groups.find((g) => g.id === groupId);
		if (!group) return;

		const allVisible = group.layers.every((l) => l.visible);
		group.layers.forEach((l) => {
			if (l.visible === allVisible) l.toggle();
		});
	};

	return (
		<div className={`layer-control-panel ${className || ""}`}>
			<div className="layer-panel-header">
				<h3>
					<Layers size={16} />
					{t("layer.title")}
				</h3>
			</div>

			<div className="view-mode-section">
				<div className="view-mode-buttons">
					{presets.map((preset) => (
						<button
							key={preset.id}
							className={`view-mode-button ${currentPreset === preset.id ? "active" : ""}`}
							onClick={() => applyPreset(preset.id)}
							title={preset.name}
						>
							{preset.icon}
							<span>{preset.name}</span>
						</button>
					))}
				</div>
			</div>

			<div className="layer-groups">
				{groups.map((group) => {
					const allVisible = group.layers.every((l) => l.visible);
					const someVisible = group.layers.some((l) => l.visible) && !allVisible;

					return (
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
										toggleAllInGroup(group.id);
									}}
									title={allVisible ? t("layer.hideAll") : t("layer.showAll")}
								>
									{allVisible ? (
										<Eye size={14} />
									) : someVisible ? (
										<EyeOff size={14} />
									) : (
										<EyeOff size={14} />
									)}
								</button>
							</div>

							{expandedGroups.has(group.id) && (
								<div className="layer-group-items">
									{group.layers.map((layer) => (
										<div key={layer.id} className="layer-item">
											<span className="layer-name">{layer.name}</span>
											<button
												className="layer-toggle-button"
												onClick={layer.toggle}
												title={layer.visible ? t("layer.hide") : t("layer.show")}
											>
												{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default LayerControlPanel;