import React, { useState, useCallback } from "react";
import { Flag } from "lucide-react";

interface FactionSelectorProps {
	currentFaction: string | undefined;
	currentPlayerId: string | null;
	factions: Record<string, { name: string; color: string; flagAssetId?: string }>;
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
		<div style={{ position: "relative" }}>
			<button
				onClick={() => setOpen(!open)}
				title={currentDef?.name ?? "选择派系"}
				style={{
					display: "flex", alignItems: "center", gap: 6,
					padding: "5px 10px", borderRadius: 6,
					background: "rgba(20,30,45,0.6)", border: "1px solid #2a3440",
					color: "#cfe8ff", cursor: "pointer", fontSize: 13,
					transition: "border-color 0.2s",
					borderColor: currentDef?.color ?? undefined,
				}}
			>
				{currentDef ? (
					<span style={{
						width: 16, height: 16, borderRadius: 3,
						background: currentDef.color, flexShrink: 0,
					}} />
				) : (
					<Flag size={14} />
				)}
				{currentDef?.name ?? "派系"}
			</button>

			{open && (
				<>
					<div
						style={{ position: "fixed", inset: 0, zIndex: 99 }}
						onClick={() => setOpen(false)}
					/>
					<div style={{
						position: "absolute", top: "100%", right: 0, marginTop: 4,
						background: "#0f1923", border: "1px solid #2a3440",
						borderRadius: 8, padding: 6, zIndex: 100, minWidth: 180,
						boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
					}}>
						<div style={{ color: "#6b8aaa", fontSize: 10, fontWeight: 600, padding: "4px 8px 6px", letterSpacing: 0.5, textTransform: "uppercase" }}>
							选择派系
						</div>

						{factionEntries.map(([fid, def]) => {
							const selected = fid === currentFaction;
							return (
								<button
									key={fid}
									onClick={() => handleSelect(fid)}
									style={{
										display: "flex", alignItems: "center", gap: 8,
										padding: "6px 8px", margin: "2px 0", borderRadius: 6,
										background: selected ? "rgba(74,158,255,0.12)" : "transparent",
										border: selected ? "1px solid rgba(74,158,255,0.25)" : "1px solid transparent",
										color: selected ? "#cfe8ff" : "#8a9db0",
										cursor: "pointer", fontSize: 13,
										textAlign: "left", width: "100%",
										transition: "background 0.15s, color 0.15s",
									}}
									onMouseEnter={(e) => {
										if (!selected) e.currentTarget.style.background = "rgba(74,158,255,0.05)";
									}}
									onMouseLeave={(e) => {
										if (!selected) e.currentTarget.style.background = "transparent";
									}}
								>
									<span style={{
										width: 20, height: 20, borderRadius: 4,
										background: def.color,
										display: "flex", alignItems: "center", justifyContent: "center",
										fontSize: 10, fontWeight: 700,
										color: "rgba(255,255,255,0.85)",
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

						{factionEntries.length === 0 && (
							<div style={{ padding: "12px 8px", color: "#5a7085", fontSize: 12, textAlign: "center" }}>
								暂无活跃派系
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
};
