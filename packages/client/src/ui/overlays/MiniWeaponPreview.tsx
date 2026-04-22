import React, { useRef, useState, useEffect, useMemo } from "react";
import type { WeaponJSON } from "@vt/data";
import "./ship-customization-modal.css";

interface MiniWeaponPreviewProps {
    weapon: WeaponJSON | null;
    texturePreviewUrl?: string | null;
}

export const MiniWeaponPreview: React.FC<MiniWeaponPreviewProps> = ({ weapon, texturePreviewUrl }) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const texture = weapon?.spec.texture;
    const textureStyle = useMemo(() => {
        const s = texture?.scale ?? 1;
        const ox = texture?.offsetX ?? 0;
        const oy = texture?.offsetY ?? 0;
        return {
            transform: `translate(${ox}px, ${oy}px) scale(${s})`,
        };
    }, [texture]);

    const sizeLabel = weapon?.spec.size ?? "SMALL";
    const damageTypeLabel = weapon?.spec.damageType ?? "KINETIC";
    const sizeScale: Record<string, number> = {
        SMALL: 60,
        MEDIUM: 80,
        LARGE: 100,
    };
    const previewSize = sizeScale[sizeLabel] ?? 60;

    return (
        <div className="customizer-preview-shell">
            <div
                ref={hostRef}
                className="customizer-preview-canvas"
                style={{
                    width: previewSize,
                    height: previewSize,
                    minWidth: previewSize,
                    minHeight: previewSize,
                    maxWidth: previewSize,
                    maxHeight: previewSize,
                }}
            >
                {mounted && (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            background: "rgba(0,0,0,0.3)",
                            borderRadius: 4,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                        }}
                    >
                        {texturePreviewUrl && (
                            <div className="customizer-preview-texture-wrap" style={textureStyle}>
                                <img
                                    src={texturePreviewUrl}
                                    className="customizer-preview-texture"
                                    alt="weapon-texture"
                                    draggable={false}
                                    style={{ maxWidth: previewSize - 10, maxHeight: previewSize - 10 }}
                                />
                            </div>
                        )}

                        {!texturePreviewUrl && weapon && (
                            <div style={{
                                color: "#6b7280",
                                fontSize: 10,
                                textAlign: "center",
                            }}>
                                <div style={{ fontSize: 12, fontWeight: "bold" }}>{sizeLabel}</div>
                                <div>{damageTypeLabel}</div>
                            </div>
                        )}

                        <div className="customizer-preview-crosshair" style={{ width: previewSize / 3, height: previewSize / 3 }} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MiniWeaponPreview;