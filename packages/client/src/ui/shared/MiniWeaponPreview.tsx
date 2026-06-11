import React, { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { Application } from "@pixi/react";
import { Graphics } from "pixi.js";
import type { WeaponJSON } from "@vt/data";
import "../overlays/ship-customization-modal.css";
import { UI_CONFIG } from "@/config/constants";

const DAMAGE_TYPE_COLORS = UI_CONFIG.COLORS.DAMAGE_TYPE_PIXI;

interface MiniWeaponPreviewProps {
    weapon: WeaponJSON | null;
    texturePreviewUrl?: string | null;
    zoom: number;
    onZoomChange: (value: number) => void;
    onTextureOffsetChange?: (deltaX: number, deltaY: number) => void;
}

function clampZoom(value: number): number {
    return Math.min(4, Math.max(0.2, value));
}

function drawWeaponAlignmentGuide(g: Graphics, size: number, damageType: string, zoom: number): void {
    const color = DAMAGE_TYPE_COLORS[damageType as keyof typeof DAMAGE_TYPE_COLORS] ?? 0x7b68ee;
    const scaledSize = size * zoom;
    const halfSize = scaledSize / 2;

    g.moveTo(-halfSize * 0.8, 0);
    g.lineTo(halfSize * 0.8, 0);
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });

    g.moveTo(0, -halfSize * 0.8);
    g.lineTo(0, halfSize * 0.8);
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });

    g.circle(0, 0, 3 * zoom);
    g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });

    const arrowLen = halfSize * 0.7;
    g.moveTo(0, 0);
    g.lineTo(0, -arrowLen);
    g.stroke({ color, width: 2.5 * zoom, alpha: 0.9 });

    const arrowTip = -arrowLen;
    const arrowW = 6 * zoom;
    g.poly([
        0, arrowTip,
        -arrowW * 0.67, arrowTip + arrowW,
        arrowW * 0.67, arrowTip + arrowW,
    ]);
    g.fill({ color, alpha: 0.8 });
}

export const MiniWeaponPreview: React.FC<MiniWeaponPreviewProps> = ({
    weapon,
    texturePreviewUrl,
    zoom,
    onZoomChange,
    onTextureOffsetChange
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const graphicsRef = useRef<Graphics | null>(null);
    const [mounted, setMounted] = useState(false);
    const [containerSize, setContainerSize] = useState({ width: 280, height: 360 });

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const sizeScale: Record<string, number> = {
        SMALL: 60,
        MEDIUM: 80,
        LARGE: 100,
    };
    const baseSize = sizeScale[weapon?.spec.size ?? "SMALL"] ?? 60;

    const drawGuide = useCallback((g: Graphics) => {
        g.clear();
        if (weapon) {
            drawWeaponAlignmentGuide(g, baseSize, weapon.spec.damageType, zoom);
        }
    }, [weapon, baseSize, zoom]);

    const handleInit = useCallback((app: any) => {
        const g = new Graphics();
        graphicsRef.current = g;
        g.position.set(containerSize.width / 2, containerSize.height / 2);
        app.stage.addChild(g);
        drawGuide(g);
    }, [drawGuide, containerSize]);

    useEffect(() => {
        if (graphicsRef.current) {
            graphicsRef.current.position.set(containerSize.width / 2, containerSize.height / 2);
            drawGuide(graphicsRef.current);
        }
    }, [drawGuide, containerSize]);

    const dragRef = useRef<{ startX: number; startY: number } | null>(null);

    const handleTextureMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragRef.current = { startX: e.clientX, startY: e.clientY };

        const handleMouseMove = (ev: MouseEvent) => {
            if (!dragRef.current || !onTextureOffsetChange) return;
            const dx = ev.clientX - dragRef.current.startX;
            const dy = ev.clientY - dragRef.current.startY;
            dragRef.current = { startX: ev.clientX, startY: ev.clientY };
            onTextureOffsetChange(-dx / zoom, -dy / zoom);
        };

        const handleMouseUp = () => {
            dragRef.current = null;
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }, [zoom, onTextureOffsetChange]);

    const texture = weapon?.spec.texture;
    const textureScale = (texture?.scale ?? 1) * zoom;
    const textureOffsetX = (texture?.offsetX ?? 0) * zoom;
    const textureOffsetY = -(texture?.offsetY ?? 0) * zoom;

    const wrapStyle = useMemo(() => ({
        transform: `translate(${textureOffsetX}px, ${textureOffsetY}px)`,
    }), [textureOffsetX, textureOffsetY]);
    
    const imgStyle = useMemo(() => ({
        transform: `translate(-50%, -50%) scale(${textureScale})`,
    }), [textureScale]);

    return (
        <div className="customizer-preview-shell">
            <div
                ref={containerRef}
                className="customizer-preview-canvas"
                onWheel={(event) => {
                    event.preventDefault();
                    const direction = event.deltaY > 0 ? -1 : 1;
                    onZoomChange(clampZoom(zoom + direction * 0.08));
                }}
            >
                {mounted && (
                    <Application
                        width={containerSize.width}
                        height={containerSize.height}
                        autoDensity
                        antialias
                        background={0x0a1218}
                        onInit={handleInit}
                    />
                )}

                {texturePreviewUrl && (
                    <div
                        className="customizer-preview-texture-wrap"
                        style={{ ...wrapStyle, cursor: onTextureOffsetChange ? "grab" : undefined }}
                        onMouseDown={onTextureOffsetChange ? handleTextureMouseDown : undefined}
                    >
                        <img
                            src={texturePreviewUrl}
                            className="customizer-preview-texture"
                            style={imgStyle}
                            alt="weapon-texture"
                            draggable={false}
                        />
                    </div>
                )}

            </div>

            <input
                type="range"
                min={0.2}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => onZoomChange(clampZoom(Number(e.target.value)))}
            />
        </div>
    );
};

export default MiniWeaponPreview;