import React, { useRef, useEffect, useCallback } from "react";
import { Application } from "@pixi/react";
import { Graphics } from "pixi.js";
import type { WeaponJSON } from "@vt/data";
import "./ship-customization-modal.css";

interface MiniWeaponPreviewProps {
    weapon: WeaponJSON | null;
    texturePreviewUrl?: string | null;
}

const DAMAGE_TYPE_COLORS = {
    KINETIC: 0xffd700,
    HIGH_EXPLOSIVE: 0xff6b35,
    ENERGY: 0x7b68ee,
    FRAGMENTATION: 0x32cd32,
} as const;

function drawWeaponAlignmentGuide(g: Graphics, size: number, damageType: string): void {
    const color = DAMAGE_TYPE_COLORS[damageType as keyof typeof DAMAGE_TYPE_COLORS] ?? 0x7b68ee;
    const halfSize = size / 2;

    g.moveTo(-halfSize * 0.8, 0);
    g.lineTo(halfSize * 0.8, 0);
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });

    g.moveTo(0, -halfSize * 0.8);
    g.lineTo(0, halfSize * 0.8);
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });

    g.circle(0, 0, 3);
    g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });

    const arrowLen = halfSize * 0.7;
    g.moveTo(0, 0);
    g.lineTo(arrowLen, 0);
    g.stroke({ color, width: 2.5, alpha: 0.9 });

    g.poly([
        arrowLen, 0,
        arrowLen - 6, -4,
        arrowLen - 6, 4,
    ]);
    g.fill({ color, alpha: 0.8 });
}

export const MiniWeaponPreview: React.FC<MiniWeaponPreviewProps> = ({ weapon, texturePreviewUrl }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphicsRef = useRef<Graphics | null>(null);

    const sizeScale: Record<string, number> = {
        SMALL: 60,
        MEDIUM: 80,
        LARGE: 100,
    };
    const previewSize = sizeScale[weapon?.spec.size ?? "SMALL"] ?? 60;

    const drawGuide = useCallback((g: Graphics) => {
        g.clear();
        if (weapon) {
            drawWeaponAlignmentGuide(g, previewSize, weapon.spec.damageType);
        }
    }, [weapon, previewSize]);

    const handleInit = useCallback((app: any) => {
        const g = new Graphics();
        graphicsRef.current = g;
        g.position.set(previewSize / 2, previewSize / 2);
        app.stage.addChild(g);
        drawGuide(g);
    }, [drawGuide, previewSize]);

    useEffect(() => {
        if (graphicsRef.current) {
            drawGuide(graphicsRef.current);
        }
    }, [drawGuide]);

    const texture = weapon?.spec.texture;
    const textureScale = texture?.scale ?? 1;
    const textureOffsetX = texture?.offsetX ?? 0;
    const textureOffsetY = texture?.offsetY ?? 0;
    const textureStyle = {
        transform: `translate(${textureOffsetX}px, ${textureOffsetY}px) scale(${textureScale})`,
    };

    return (
        <div className="customizer-preview-shell">
            <div
                ref={containerRef}
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
                <Application
                    resizeTo={containerRef}
                    autoDensity
                    antialias
                    background={0x0a1218}
                    onInit={handleInit}
                />

                {texturePreviewUrl && (
                    <div className="customizer-preview-texture-wrap" style={textureStyle}>
                        <img
                            src={texturePreviewUrl}
                            className="customizer-preview-texture"
                            alt="weapon-texture"
                            draggable={false}
                        />
                    </div>
                )}

                {!texturePreviewUrl && weapon && (
                    <div style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#6b7280",
                        fontSize: 10,
                        textAlign: "center",
                        pointerEvents: "none",
                    }}>
                        <div style={{ fontSize: 12, fontWeight: "bold" }}>{weapon.spec.size}</div>
                        <div>{weapon.spec.damageType}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MiniWeaponPreview;