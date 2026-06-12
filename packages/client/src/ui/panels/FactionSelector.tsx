import React, { useState, useCallback, useEffect, useRef } from "react";
import { Flag } from "lucide-react";
import { textureManager } from "@/renderer/systems/TextureManager";

interface FactionDefBrief {
    name: string;
    color: string;
    flagAssetId?: string;
}

interface FactionSelectorProps {
    currentFaction: string | undefined;
    currentPlayerId: string | null;
    factions: Record<string, FactionDefBrief>;
    onFactionChange?: (playerId: string, faction: string) => void;
}

export const FactionSelector: React.FC<FactionSelectorProps> = ({
    currentFaction, currentPlayerId, factions, onFactionChange,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [flagUrls, setFlagUrls] = useState<Record<string, string>>({});
    const loadedRef = useRef(false);

    const loadFlags = useCallback(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;
        const urls: Record<string, string> = {};
        for (const f of Object.values(factions)) {
            if (f.flagAssetId) {
                urls[f.flagAssetId] = textureManager.getTextureUrl(f.flagAssetId);
            }
        }
        setFlagUrls(urls);
    }, [factions]);

    useEffect(() => { if (open) loadFlags(); }, [open, loadFlags]);

    const handleSelect = useCallback((factionId: string) => {
        if (currentPlayerId && onFactionChange) {
            onFactionChange(currentPlayerId, factionId);
        }
        setOpen(false);
        setSearch("");
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
                        onClick={() => { setOpen(false); setSearch(""); }}
                    />
                    <div style={{
                        position: "absolute", top: "100%", right: 0, marginTop: 4,
                        background: "#0f1923", border: "1px solid #2a3440",
                        borderRadius: 8, padding: 6, zIndex: 100, minWidth: 200,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                        maxHeight: 320, display: "flex", flexDirection: "column",
                    }}>
                        <div style={{ color: "#6b8aaa", fontSize: 10, fontWeight: 600, padding: "4px 8px 2px", letterSpacing: 0.5, textTransform: "uppercase" }}>
                            选择派系
                        </div>
                        <input
                            type="text"
                            placeholder="搜索派系..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                            style={{
                                width: "100%", padding: "5px 8px", margin: "4px 0",
                                background: "rgba(0,0,0,0.3)", border: "1px solid rgba(43,66,97,0.6)",
                                borderRadius: 4, color: "#cfe8ff", fontSize: 12, outline: "none",
                                boxSizing: "border-box",
                            }}
                        />
                        <div style={{ overflowY: "auto", flex: 1 }}>
                        {factionEntries.filter(([, def]) => !search.trim() || def.name.toLowerCase().includes(search.trim().toLowerCase())).map(([fid, def]) => {
                            const selected = fid === currentFaction;
                            const flagUrl = def.flagAssetId ? flagUrls[def.flagAssetId] : undefined;
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
                                        background: flagUrl
                                            ? `url(${flagUrl}) center/cover`
                                            : def.color,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 10, fontWeight: 700,
                                        color: flagUrl ? "transparent" : "rgba(255,255,255,0.85)",
                                        flexShrink: 0,
                                        overflow: "hidden",
                                    }}>
                                        {flagUrl ? undefined : def.name.charAt(0)}
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

                        {factionEntries.filter(([, def]) => !search.trim() || def.name.toLowerCase().includes(search.trim().toLowerCase())).length === 0 && (
                            <div style={{ padding: "12px 8px", color: "#5a7085", fontSize: 12, textAlign: "center" }}>
                                {search.trim() ? "无匹配派系" : "暂无活跃派系"}
                            </div>
                        )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
