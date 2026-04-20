/**
 * 辐能/过载状态指示器渲染器
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { ShipRuntime } from "@vt/data";
import { FluxState } from "@vt/data";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { useEffect, useRef } from "react";
import { useUIStore } from "@/state/stores/uiStore";

const FLUX_RING_RADIUS = 45;
const FLUX_RING_WIDTH = 6;
const OVERLOAD_ICON_SIZE = 16;
const OVERLOAD_TEXT_OFFSET_Y = 20;
const FLUX_WARNING_THRESHOLD = 0.7;
const FLUX_CRITICAL_THRESHOLD = 0.9;

const FLUX_COLORS = {
	NORMAL: 0x4fc3ff,
	WARNING: 0xffce66,
	CRITICAL: 0xff5d7e,
	OVERLOADED: 0xff2d4a,
	VENTING: 0x57e38d,
};

const overloadTextStyle = new TextStyle({
	fill: 0xff5d7e,
	fontSize: 10,
	fontFamily: "Arial, sans-serif",
	fontWeight: "bold",
	stroke: { color: 0x081423, width: 2 },
});

function getFluxColor(fluxPercent: number, fluxState: string): number {
	if (fluxState === FluxState.OVERLOADED) return FLUX_COLORS.OVERLOADED;
	if (fluxState === FluxState.VENTING) return FLUX_COLORS.VENTING;
	if (fluxPercent >= FLUX_CRITICAL_THRESHOLD) return FLUX_COLORS.CRITICAL;
	if (fluxPercent >= FLUX_WARNING_THRESHOLD) return FLUX_COLORS.WARNING;
	return FLUX_COLORS.NORMAL;
}

function drawFluxRing(
	graphics: Graphics,
	radius: number,
	fluxPercent: number,
	fluxState: string
): void {
	graphics.clear();

	const width = FLUX_RING_WIDTH;
	const color = getFluxColor(fluxPercent, fluxState);

	if (fluxState === FluxState.OVERLOADED) {
		graphics.arc(0, 0, radius, 0, Math.PI * 2);
		graphics.stroke({ color: FLUX_COLORS.OVERLOADED, width, alpha: 0.8 });
		graphics.arc(0, 0, radius - width / 2, 0, Math.PI * 2);
		graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
		return;
	}

	if (fluxState === FluxState.VENTING) {
		const ventAngle = Math.PI * 2 * (1 - fluxPercent);
		graphics.arc(0, 0, radius, 0, ventAngle);
		graphics.stroke({ color: FLUX_COLORS.VENTING, width, alpha: 0.9 });
		return;
	}

	const fluxAngle = Math.PI * 2 * fluxPercent;

	graphics.arc(0, 0, radius, 0, Math.PI * 2);
	graphics.stroke({ color: 0x1a2a3a, width: width, alpha: 0.5 });

	graphics.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + fluxAngle);
	graphics.stroke({ color, width, alpha: 0.95 });

	graphics.arc(0, 0, radius + 2, -Math.PI / 2, -Math.PI / 2 + fluxAngle);
	graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.2 });
}

function drawOverloadWarning(graphics: Graphics, size: number): void {
	graphics.clear();
	const halfSize = size / 2;
	graphics.poly([
		halfSize * 0.3, -halfSize,
		halfSize * 0.8, -halfSize * 0.2,
		halfSize * 0.4, -halfSize * 0.2,
		halfSize, halfSize,
		halfSize * 0.2, halfSize * 0.2,
		halfSize * 0.6, halfSize * 0.2,
		-halfSize, -halfSize * 0.3,
	]);
	graphics.fill({ color: 0xff5d7e, alpha: 0.9 });
	graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
}

function computeFluxState(ship: ShipRuntime & { id: string; fluxCapacity?: number }): { percent: number; state: string } {
	const fluxSoft = ship.fluxSoft ?? 0;
	const fluxHard = ship.fluxHard ?? 0;
	const capacity = ship.fluxCapacity ?? 100;
	const total = fluxSoft + fluxHard;
	const percent = total / capacity;

	if (ship.overloaded) return { percent: 1, state: FluxState.OVERLOADED };
	if (ship.venting) return { percent, state: FluxState.VENTING };
	if (percent >= FLUX_CRITICAL_THRESHOLD) return { percent, state: FluxState.HIGH };
	if (percent >= FLUX_WARNING_THRESHOLD) return { percent, state: FluxState.HIGH };
	return { percent, state: FluxState.NORMAL };
}

export interface FluxIndicatorCacheItem {
	root: Container;
	fluxRing: Graphics;
	overloadIcon: Graphics;
	overloadText: Text;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		fluxPercent: number;
		fluxState: string;
		isOverloaded: boolean;
		overloadTime: number;
	};
}

export interface FluxIndicatorOptions {
	show?: boolean;
	fluxCapacity?: number;
}

export function useFluxIndicatorRendering(
	layers: LayerRegistry | null,
	ships: (ShipRuntime & { id: string; fluxCapacity?: number })[],
	options: FluxIndicatorOptions = {}
) {
	const cacheRef = useRef<Map<string, FluxIndicatorCacheItem>>(new Map());
	const showFluxIndicators = useUIStore((state) => state.showFluxIndicators);
	const show = options.show ?? showFluxIndicators;
	const defaultCapacity = options.fluxCapacity ?? 100;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.id));

		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.fluxIndicators.removeChild(item.root);
				cache.delete(id);
			}
		}

		for (const ship of ships) {
			const cached = cache.get(ship.id);
			if (!cached) {
				createFluxIndicator(layers, cache, ship, defaultCapacity);
				continue;
			}

			if (shouldUpdateFlux(cached, ship, defaultCapacity)) {
				updateFluxIndicator(cached, ship, defaultCapacity);
			}
		}

		layers.fluxIndicators.visible = show;
	}, [layers, ships, show, defaultCapacity]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function shouldUpdateFlux(
	cached: FluxIndicatorCacheItem,
	ship: ShipRuntime & { id: string; fluxCapacity?: number },
	defaultCapacity: number
): boolean {
	if (!cached.lastState || !ship.position) return true;

	const last = cached.lastState;
	const dx = Math.abs(ship.position.x - last.x);
	const dy = Math.abs(ship.position.y - last.y);
	const dHeading = Math.abs(ship.heading - last.heading);

	const flux = computeFluxState({ ...ship, fluxCapacity: ship.fluxCapacity ?? defaultCapacity });
	const fluxChanged =
		flux.percent !== last.fluxPercent ||
		flux.state !== last.fluxState ||
		ship.overloaded !== last.isOverloaded ||
		ship.overloadTime !== last.overloadTime;

	return dx > 0.5 || dy > 0.5 || dHeading > 1 || fluxChanged;
}

function createFluxIndicator(
	layers: LayerRegistry,
	cache: Map<string, FluxIndicatorCacheItem>,
	ship: ShipRuntime & { id: string; fluxCapacity?: number },
	defaultCapacity: number
): void {
	if (!ship.position) return;

	const root = new Container();
	root.position.set(ship.position.x, ship.position.y);

	const capacity = ship.fluxCapacity ?? defaultCapacity;
	const flux = computeFluxState({ ...ship, fluxCapacity: capacity });
	const radius = FLUX_RING_RADIUS;

	const fluxRing = new Graphics();
	drawFluxRing(fluxRing, radius, flux.percent, flux.state);
	root.addChild(fluxRing);

	const overloadIcon = new Graphics();
	if (ship.overloaded) {
		drawOverloadWarning(overloadIcon, OVERLOAD_ICON_SIZE);
	}
	overloadIcon.position.set(0, -radius - OVERLOAD_ICON_SIZE / 2);
	overloadIcon.visible = ship.overloaded ?? false;
	root.addChild(overloadIcon);

	const overloadText = new Text({
		text: formatOverloadTime(ship.overloadTime ?? 0),
		style: overloadTextStyle,
	});
	overloadText.anchor.set(0.5, 0.5);
	overloadText.position.set(0, -radius - OVERLOAD_TEXT_OFFSET_Y);
	overloadText.visible = (ship.overloaded ?? false) && (ship.overloadTime ?? 0) > 0;
	root.addChild(overloadText);

	layers.fluxIndicators.addChild(root);

	cache.set(ship.id, {
		root,
		fluxRing,
		overloadIcon,
		overloadText,
		lastState: {
			x: ship.position.x,
			y: ship.position.y,
			heading: ship.heading,
			fluxPercent: flux.percent,
			fluxState: flux.state,
			isOverloaded: ship.overloaded ?? false,
			overloadTime: ship.overloadTime ?? 0,
		},
	});
}

function updateFluxIndicator(
	cached: FluxIndicatorCacheItem,
	ship: ShipRuntime & { id: string; fluxCapacity?: number },
	defaultCapacity: number
): void {
	if (!ship.position) return;

	cached.root.position.set(ship.position.x, ship.position.y);

	const capacity = ship.fluxCapacity ?? defaultCapacity;
	const flux = computeFluxState({ ...ship, fluxCapacity: capacity });
	const radius = FLUX_RING_RADIUS;

	drawFluxRing(cached.fluxRing, radius, flux.percent, flux.state);

	cached.overloadIcon.visible = ship.overloaded ?? false;
	if (ship.overloaded) {
		drawOverloadWarning(cached.overloadIcon, OVERLOAD_ICON_SIZE);
	}

	cached.overloadText.visible = (ship.overloaded ?? false) && (ship.overloadTime ?? 0) > 0;
	if (ship.overloaded && ship.overloadTime) {
		cached.overloadText.text = formatOverloadTime(ship.overloadTime);
	}

	cached.lastState = {
		x: ship.position.x,
		y: ship.position.y,
		heading: ship.heading,
		fluxPercent: flux.percent,
		fluxState: flux.state,
		isOverloaded: ship.overloaded ?? false,
		overloadTime: ship.overloadTime ?? 0,
	};
}

function formatOverloadTime(time: number): string {
	if (time <= 0) return "";
	const seconds = Math.ceil(time);
	return `${seconds}s`;
}