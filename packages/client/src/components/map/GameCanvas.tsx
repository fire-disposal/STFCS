import React, { useEffect, useMemo, useRef, useState } from "react";
import { Application } from "@pixi/react";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { ShipState } from "@vt/shared";

interface GameCanvasProps {
  ships: ShipState[];
  width?: number;
  height?: number;
  zoom: number;
  cameraX: number;
  cameraY: number;
  showGrid: boolean;
  selectedShipId?: string | null;
  onSelectShip?: (shipId: string) => void;
}

type LayerRegistry = {
  world: Container;
  background: Container;
  grid: Container;
  ships: Container;
  labels: Container;
  effects: Container;
};

const labelStyle = new TextStyle({
  fill: 0xcfe8ff,
  fontSize: 11,
  fontFamily: "Arial",
  stroke: { color: 0x10263e, width: 2 },
});

const generateStars = (count: number, range = 4000) => {
  const stars: Array<{ x: number; y: number; alpha: number; r: number }> = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random() * range - range / 2,
      y: Math.random() * range - range / 2,
      alpha: 0.2 + Math.random() * 0.7,
      r: 0.7 + Math.random() * 1.8,
    });
  }
  return stars;
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  ships,
  width = 980,
  height = 620,
  zoom,
  cameraX,
  cameraY,
  showGrid,
  selectedShipId,
  onSelectShip,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<LayerRegistry | null>(null);
  const stars = useMemo(() => generateStars(900), []);

  useEffect(() => {
    if (!layers) return;

    layers.world.scale.set(zoom);
    layers.world.position.set(
      width * 0.5 - cameraX * zoom,
      height * 0.5 - cameraY * zoom,
    );
  }, [layers, zoom, cameraX, cameraY, width, height]);

  useEffect(() => {
    if (!layers) return;

    layers.background.removeChildren();
    const starField = new Graphics();
    for (const s of stars) {
      starField.circle(s.x, s.y, s.r).fill({ color: 0xffffff, alpha: s.alpha });
    }
    layers.background.addChild(starField);
  }, [layers, stars]);

  useEffect(() => {
    if (!layers) return;

    layers.grid.removeChildren();
    if (!showGrid) return;

    const grid = new Graphics();
    const gridSize = 100;
    const half = 3000;

    for (let x = -half; x <= half; x += gridSize) {
      const isAxis = x === 0;
      grid
        .moveTo(x, -half)
        .lineTo(x, half)
        .stroke({ color: isAxis ? 0x4a9eff : 0x2a3d55, alpha: isAxis ? 0.4 : 0.2, width: 1 });
    }

    for (let y = -half; y <= half; y += gridSize) {
      const isAxis = y === 0;
      grid
        .moveTo(-half, y)
        .lineTo(half, y)
        .stroke({ color: isAxis ? 0x4a9eff : 0x2a3d55, alpha: isAxis ? 0.4 : 0.2, width: 1 });
    }

    layers.grid.addChild(grid);
  }, [layers, showGrid]);

  useEffect(() => {
    if (!layers) return;

    layers.ships.removeChildren();
    layers.labels.removeChildren();

    for (const ship of ships) {
      const token = new Graphics();
      const isSelected = ship.id === selectedShipId;
      const color = ship.faction === "player" ? 0x43c1ff : 0xff6f8f;
      const radius = 20;

      token
        .poly([
          0,
          -radius,
          radius * 0.7,
          radius,
          0,
          radius * 0.45,
          -radius * 0.7,
          radius,
        ])
        .fill({ color, alpha: 0.88 })
        .stroke({
          color: isSelected ? 0xffffff : 0x10263e,
          alpha: isSelected ? 0.95 : 0.7,
          width: isSelected ? 3 : 2,
        });

      token.position.set(ship.transform.x, ship.transform.y);
      token.rotation = (ship.transform.heading * Math.PI) / 180;
      token.eventMode = "static";
      token.cursor = "pointer";
      token.on("pointertap", () => onSelectShip?.(ship.id));

      const hpPercent = Math.max(0, Math.min(1, ship.hullMax > 0 ? ship.hullCurrent / ship.hullMax : 0));
      const hpBg = new Graphics();
      hpBg
        .rect(-24, radius + 8, 48, 5)
        .fill({ color: 0x000000, alpha: 0.45 })
        .rect(-24, radius + 8, 48 * hpPercent, 5)
        .fill({ color: 0x3ddb6f, alpha: 0.95 });
      token.addChild(hpBg);

      const label = new Text({
        text: `${ship.id.slice(-6)}  F:${Math.round(ship.fluxHard + ship.fluxSoft)}/${Math.round(ship.fluxMax)}`,
        style: labelStyle,
      });
      label.anchor.set(0.5, 1);
      label.position.set(ship.transform.x, ship.transform.y - radius - 8);

      layers.ships.addChild(token);
      layers.labels.addChild(label);
    }
  }, [layers, ships, selectedShipId, onSelectShip]);

  return (
    <div ref={hostRef} style={{ width, height, border: "1px solid #2b4261", borderRadius: 8, overflow: "hidden" }}>
      <Application
        resizeTo={hostRef}
        autoDensity
        antialias
        background={0x06101a}
        eventMode="static"
        onInit={(app) => {
          const world = new Container();
          world.sortableChildren = true;

          const background = new Container();
          background.zIndex = 0;

          const grid = new Container();
          grid.zIndex = 1;

          const shipsLayer = new Container();
          shipsLayer.zIndex = 2;

          const labels = new Container();
          labels.zIndex = 3;

          const effects = new Container();
          effects.zIndex = 4;

          world.addChild(background, grid, shipsLayer, labels, effects);
          app.stage.addChild(world);

          setLayers({ world, background, grid, ships: shipsLayer, labels, effects });
        }}
      />
    </div>
  );
};

export default GameCanvas;
