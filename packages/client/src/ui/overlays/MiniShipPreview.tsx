import React, { useEffect, useMemo, useRef, useState } from "react";
import { Application } from "@pixi/react";
import { Container, Rectangle } from "pixi.js";
import { Faction } from "@vt/data";
import type { InventoryToken, CombatToken } from "@vt/data";
import type { LayerRegistry } from "@/renderer";
import { useLayerSystem, useShipRendering } from "@/renderer";
import { useCanvasResize } from "@/renderer/core/useCanvasResize";

interface MiniShipPreviewProps {
    token: InventoryToken | null;
    zoom: number;
    onZoomChange: (value: number) => void;
    texturePreviewUrl?: string | null;
}

function clampZoom(value: number): number {
    return Math.min(4, Math.max(0.2, value));
}

function createLayers(app: any): LayerRegistry {
    const world = new Container();
    world.sortableChildren = true;
    world.eventMode = "none";
    world.hitArea = new Rectangle(-10000, -10000, 20000, 20000);

    const background = new Container();
    background.zIndex = 0;
    background.eventMode = "none";

    const starfieldNebula = new Container();
    starfieldNebula.zIndex = 0;
    starfieldNebula.eventMode = "none";

    const starfieldDeep = new Container();
    starfieldDeep.zIndex = 1;
    starfieldDeep.eventMode = "none";

    const starfieldMid = new Container();
    starfieldMid.zIndex = 2;
    starfieldMid.eventMode = "none";

    const starfieldNear = new Container();
    starfieldNear.zIndex = 3;
    starfieldNear.eventMode = "none";

    const grid = new Container();
    grid.zIndex = 4;
    grid.eventMode = "none";

    const cursor = new Container();
    cursor.zIndex = 5;
    cursor.eventMode = "none";

    const tacticalTokens = new Container();
    tacticalTokens.zIndex = 7;
    tacticalTokens.eventMode = "none";

    const weaponArcs = new Container();
    weaponArcs.zIndex = 8;
    weaponArcs.eventMode = "none";

    const movementVisuals = new Container();
    movementVisuals.zIndex = 9;
    movementVisuals.eventMode = "none";

    const shieldArcs = new Container();
    shieldArcs.zIndex = 10;
    shieldArcs.eventMode = "none";

    const hexagonArmor = new Container();
    hexagonArmor.zIndex = 11;
    hexagonArmor.eventMode = "none";

    const shipSprites = new Container();
    shipSprites.zIndex = 13;
    shipSprites.eventMode = "none";

    const weaponSprites = new Container();
    weaponSprites.zIndex = 14;
    weaponSprites.eventMode = "none";

    world.addChild(
        background,
        starfieldNebula,
        starfieldDeep,
        starfieldMid,
        starfieldNear,
        grid,
        cursor,
        tacticalTokens,
        weaponArcs,
        movementVisuals,
        shieldArcs,
        hexagonArmor,
        shipSprites,
        weaponSprites
    );

    const hud = new Container();
    hud.sortableChildren = true;
    hud.eventMode = "none";

    const shipBars = new Container();
    shipBars.zIndex = 0;
    shipBars.eventMode = "none";

    const fluxBars = new Container();
    fluxBars.zIndex = 1;
    fluxBars.eventMode = "none";

    const shipNames = new Container();
    shipNames.zIndex = 2;
    shipNames.eventMode = "none";

    const ownerLabels = new Container();
    ownerLabels.zIndex = 3;
    ownerLabels.eventMode = "none";

    hud.addChild(shipBars, fluxBars, shipNames, ownerLabels);

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
        starMapEdges: world,
        starMapNodes: world,
        shipSprites,
        weaponSprites,
        tacticalTokens,
        weaponArcs,
        movementVisuals,
        shieldArcs,
        hexagonArmor,
        hud,
        shipBars,
        fluxBars,
        shipNames,
        ownerLabels,
    };
}

function toPreviewShip(token: InventoryToken): CombatToken & { selected?: boolean } {
    const spec = token.spec;
    const runtime = {
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
        actionSequence: 0,
        faction: Faction.PLAYER_ALLIANCE,
    };

    return {
        $id: token.$id,
        $presetRef: token.$presetRef,
        spec,
        runtime,
        metadata: token.metadata,
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

    const texture = token?.spec.texture;
    const textureScale = (texture?.scale ?? 1) * zoom;
    // 航海坐标系：Y向上，屏幕坐标系：Y向下
    // offsetY > 0（船头方向）在屏幕上是向上（负方向）
    const textureOffsetX = (texture?.offsetX ?? 0) * zoom;
    const textureOffsetY = -(texture?.offsetY ?? 0) * zoom; // 反转 Y

    // wrap 负责偏移，img 负责缩放和居中
    const wrapStyle = useMemo(() => ({
        transform: `translate(${textureOffsetX}px, ${textureOffsetY}px)`,
    }), [textureOffsetX, textureOffsetY]);

    const imgStyle = useMemo(() => ({
        transform: `translate(-50%, -50%) scale(${textureScale})`,
    }), [textureScale]);

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
                    <div className="customizer-preview-texture-wrap" style={wrapStyle}>
                        <img src={texturePreviewUrl} className="customizer-preview-texture" style={imgStyle} alt="texture-preview" draggable={false} />
                    </div>
                )}

                <div className="customizer-preview-crosshair" />
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

export default MiniShipPreview;
