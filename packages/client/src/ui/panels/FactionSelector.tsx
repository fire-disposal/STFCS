import React, { useState, useCallback } from "react";
import { Flag } from "lucide-react";

interface FactionSelectorProps {
	currentFaction: string | undefined;
	currentPlayerId: string | null;
	factions: Record<string, { name: string; color: string }>;
	onFactionChange?: (playerId: string, faction: string) => void;
}

export const FactionSelector: React.FC<FactionSelectorProps> = ({
	currentFaction, currentPlayerId, factions, onFactionChange,
}) => {
	const [open, setOpen] = useState(false);

	const handleSelect = useCallback((factionId: string) => {
		if (currentPlayerId && onFactionChange) {
			onFactionChange(currentPlayerId, factionId);
		}
		setOpen(false);
	}, [currentPlayerId, onFactionChange]);

	if (!currentPlayerId || !onFactionChange) return null;

	const factionOptions = Object.entries(factions);
	const currentDef = currentFaction ? factions[currentFaction] : undefined;

	return (
		<div className="top-bar__faction-selector" style={{ position: "relative" }}>
			<button
				className="top-bar__action-btn"
				onClick={() => setOpen(!open)}
				title={currentDef?.name ?? currentFaction ?? "选择派系"}
				style={{
					borderColor: currentDef?.color ?? undefined,
					borderWidth: 1,
					borderStyle: "solid",
				}}
			>
				<Flag size={16} />
				{currentDef?.name ?? currentFaction ?? "派系"}
			</button>
			{open && (
				<div
					className="top-bar__faction-dropdown"
					style={{
						position: "absolute", top: "100%", right: 0,
						background: "#141a24", border: "1px solid #2a3440",
						borderRadius: 6, padding: 4, zIndex: 100, minWidth: 140,
					}}
				>
					{factionOptions.map(([factionId, def]) => (
						<button
							key={factionId}
							className="top-bar__faction-option"
							onClick={() => handleSelect(factionId)}
							style={{
								display: "flex", alignItems: "center", gap: 8,
								width: "100%", padding: "6px 10px",
								background: currentFaction === factionId ? "rgba(74, 158, 255, 0.15)" : "transparent",
								border: "none", borderRadius: 4, color: "#cfe8ff", cursor: "pointer", fontSize: 12,
							}}
							onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(74, 158, 255, 0.1)")}
							onMouseLeave={(e) => (e.currentTarget.style.background = currentFaction === factionId ? "rgba(74, 158, 255, 0.15)" : "transparent")}
						>
							<span style={{ width: 10, height: 10, borderRadius: "50%", background: def.color }} />
							{def.name}
						</button>
					))}
				</div>
			)}
		</div>
	);
};
