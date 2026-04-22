import React, { useEffect, useMemo, useRef, useState } from "react";
import { Application } from "@pixi/react";
import { Container, Rectangle } from "pixi.js";
import { Faction } from "@vt/data";
import type { TokenJSON } from "@vt/data";
import type { LayerRegistry, ShipViewModel } from "@/renderer";
import { useLayerSystem, useShipRendering } from "@/renderer";
import { useCanvasResize } from "@/renderer/core/useCanvasResize";

interface MiniShipPreviewProps {
    token: TokenJSON | null;
    zoom: number;
    onZoomChange: (value: number) => void;
    texturePreviewUrl?: string | null;
}

function clampZoom(value: number): number {
    return Math.min(2.2, Math.max(0.4, value));
}

function createLayers(app: any): LayerRegistry {
    const world = new Container();
    world.sortableChildren = true;
    world.eventMode = "none";
    world.hitArea = new Rectangle(-10000, -10000, 20000, 20000);

    const background = new Container();
    const starfieldNebula = new Container();
    const starfieldDeep = new Container();
    const starfieldMid = new Container();
    const starfieldNear = new Container();
    const grid = new Container();
    const cursor = new Container();
    const shipSprites = new Container();
    const tacticalTokens = new Container();
    const effects = new Container();
    const weaponArcs = new Container();
    const movementVisuals = new Container();
    const shipIcons = new Container();
    const shieldArcs = new Container();
    const hexagonArmor = new Container();
    const fluxIndicators = new Container();

    world.addChild(
        background,
        starfieldNebula,
        starfieldDeep,
        starfieldMid,
        starfieldNear,
        grid,
        cursor,
        shipSprites,
        tacticalTokens,
        effects,
        weaponArcs,
        movementVisuals,
        shipIcons,
        shieldArcs,
        hexagonArmor,
        fluxIndicators
    );

    const hud = new Container();
    const shipBars = new Container();
    const shipNames = new Container();
    const targetMarkers = new Container();
    hud.addChild(shipBars, shipNames, targetMarkers);

    app.stage.addChild(world);
    app.stage.addChild(hud);

    return {
        world,
        background,
        starfieldNebula,
        starfieldDeep,
        starfieldMid,
        starfieldNear,
        grid,
        cursor,
        shipSprites,
        tacticalTokens,
        effects,
        weaponArcs,
        movementVisuals,
        shipIcons,
        shieldArcs,
        hexagonArmor,
        fluxIndicators,
        hud,
        shipBars,
        shipNames,
        targetMarkers,
    };
}

function toPreviewShip(token: TokenJSON): ShipViewModel {
    const spec = token.token ?? token.spec;
    const runtime = token.runtime ?? {
        position: { x: 0, y: 0 },
        heading: 0,
        hull: spec.maxHitPoints,
        armor: [
            spec.armorMaxPerQuadrant,
            spec.armorMaxPerQuadrant,
            spec.armorMaxPerQuadrant,
            spec.armorMaxPerQuadrant,
            spec.armorMaxPerQuadrant,
            spec.armorMaxPerQuadrant,
        ],
        fluxSoft: 0,
        fluxHard: 0,
        overloaded: false,
        overloadTime: 1,
        destroyed: false,
        faction: Faction.PLAYER,
    };

    return {
        $id: token.$id,
        $presetRef: token.$presetRef,
        spec,
        runtime,
        metadata: token.metadata,
        id: token.$id,
    };
}

export const MiniShipPreview: React.FC<MiniShipPreviewProps> = ({ token, zoom, onZoomChange, texturePreviewUrl }) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const canvasSize = useCanvasResize(hostRef);
    const layerSystem = useLayerSystem();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const ships = useMemo(() => {
        if (!token) return [];
        return [toPreviewShip(token)];
    }, [token]);

    const texture = token?.token.texture;
    const textureStyle = useMemo(() => {
        const s = texture?.scale ?? 1;
        const ox = texture?.offsetX ?? 0;
        const oy = texture?.offsetY ?? 0;
        return {
            transform: `translate(${ox}px, ${oy}px) scale(${s})`,
        };
    }, [texture]);

    useShipRendering(
        layerSystem.layers,
        ships,
        null,
        {
            zoom,
            x: 0,
            y: 0,
            canvasWidth: canvasSize.width,
            canvasHeight: canvasSize.height,
            viewRotation: 0,
        },
        {}
    );

    useEffect(() => {
        if (!layerSystem.layers) return;
        layerSystem.updateWorldTransforms(zoom, 0, 0, canvasSize, 0, false);
        layerSystem.updateHitAreas(canvasSize);
    }, [layerSystem, canvasSize, zoom]);

    return (
        <div className="customizer-preview-shell">
            <div
                ref={hostRef}
                className="customizer-preview-canvas"
                onWheel={(event) => {
                    event.preventDefault();
                    const direction = event.deltaY > 0 ? -1 : 1;
                    onZoomChange(clampZoom(zoom + direction * 0.08));
                }}
            >
                {mounted && (
                    <Application
                        resizeTo={hostRef}
                        autoDensity
                        antialias
                        background={0x050d18}
                        eventMode="none"
                        onInit={(app) => {
                            const layers = createLayers(app);
                            layerSystem.setLayers(layers);
                        }}
                    />
                )}

                {texturePreviewUrl && (
                    <div className="customizer-preview-texture-wrap" style={textureStyle}>
                        <img src={texturePreviewUrl} className="customizer-preview-texture" alt="texture-preview" draggable={false} />
                    </div>
                )}

                <div className="customizer-preview-crosshair" />
            </div>

            <input
                type="range"
                min={0.4}
                max={2.2}
                step={0.01}
                value={zoom}
                onChange={(e) => onZoomChange(clampZoom(Number(e.target.value)))}
            />
        </div>
    );
};

export default MiniShipPreview;
