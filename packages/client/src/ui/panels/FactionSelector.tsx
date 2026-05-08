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

	const factionEntries = Object.entries(factions);
	const currentDef = currentFaction ? factions[currentFaction] : undefined;

	return (
		<div className="faction-selector" style={{ position: "relative" }}>
			<button
				className="top-bar__action-btn"
				onClick={() => setOpen(!open)}
				title={currentDef?.name ?? "选择派系"}
				style={{
					borderColor: currentDef?.color ?? undefined,
					borderWidth: 1, borderStyle: "solid",
				}}
			>
				<Flag size={16} />
				{currentDef?.name ?? currentFaction ?? "派系"}
			</button>

			{open && (
				<>
					<div
						style={{ position: "fixed", inset: 0, zIndex: 99 }}
						onClick={() => setOpen(false)}
					/>
					<div className="faction-selector__popup" style={{
						position: "absolute", top: "100%", right: 0,
						background: "#111826", border: "1px solid #2a3440",
						borderRadius: 8, padding: 10, zIndex: 100, minWidth: 200,
						boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
					}}>
						<div style={{ color: "#6b8aaa", fontSize: 11, fontWeight: 600, marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
							选择派系
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
							{factionEntries.map(([fid, def]) => {
								const selected = fid === currentFaction;
								return (
									<button
										key={fid}
										onClick={() => handleSelect(fid)}
										style={{
											display: "flex", alignItems: "center", gap: 10,
											padding: "8px 10px", borderRadius: 6,
											background: selected ? "rgba(74,158,255,0.12)" : "transparent",
											border: selected ? "1px solid rgba(74,158,255,0.3)" : "1px solid transparent",
											color: "#cfe8ff", cursor: "pointer", fontSize: 13,
											textAlign: "left", width: "100%",
											transition: "background 0.15s",
										}}
										onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "rgba(74,158,255,0.06)"; }}
										onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "transparent"; }}
									>
										<span style={{
											width: 24, height: 24, borderRadius: 4,
											background: def.color,
											display: "flex", alignItems: "center", justifyContent: "center",
											fontSize: 12, fontWeight: 800,
											color: "rgba(255,255,255,0.8)",
											flexShrink: 0,
										}}>
											{def.name.charAt(0)}
										</span>
										<span style={{ flex: 1, fontWeight: selected ? 600 : 400 }}>
											{def.name}
										</span>
										{selected && (
											<span style={{ color: "#4a9eff", fontSize: 10, fontWeight: 600 }}>当前</span>
										)}
									</button>
								);
							})}
						</div>
					</div>
				</>
			)}
		</div>
	);
};
