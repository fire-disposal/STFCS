import type { StarfieldGenerator } from "@/features/game/rendering/StarfieldBackground";
import { Graphics } from "pixi.js";
import { useCallback, useEffect, useRef } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export function useStarfieldRendering(
	layers: LayerRegistry | null,
	starfield: StarfieldGenerator
): void {
	const animationFrameRef = useRef<number | null>(null);
	const lastTimeRef = useRef<number>(0);
	const frameCountRef = useRef(0);

	const renderStarfield = useCallback(() => {
		if (!layers || !starfield) return;

		const animate = (timestamp: number) => {
			const deltaTime = (timestamp - lastTimeRef.current) / 1000;
			lastTimeRef.current = timestamp;
			frameCountRef.current++;

			const safeDelta = Math.min(deltaTime, 0.1);
			starfield.update(safeDelta);

			if (frameCountRef.current % 3 === 0 && layers.starfieldDeep.children[0]) {
				const graphics = layers.starfieldDeep.children[0] as Graphics;
				graphics.clear();
				starfield.drawDeepStars(graphics, 0, 0);
			}

			if (frameCountRef.current % 2 === 0 && layers.starfieldMid.children[0]) {
				const graphics = layers.starfieldMid.children[0] as Graphics;
				graphics.clear();
				starfield.drawMidStars(graphics, 0, 0);
			}

			if (layers.starfieldNear.children[0]) {
				const graphics = layers.starfieldNear.children[0] as Graphics;
				graphics.clear();
				starfield.drawNearStars(graphics, 0, 0);
			}

			animationFrameRef.current = requestAnimationFrame(animate);
		};

		animationFrameRef.current = requestAnimationFrame(animate);

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [layers, starfield]);

	useEffect(() => {
		const cleanup = renderStarfield();
		return cleanup;
	}, [renderStarfield]);
}

export function useInitializeStarfield(
	layers: LayerRegistry | null,
	starfield: StarfieldGenerator
) {
	useEffect(() => {
		if (!layers || !starfield) return;

		layers.starfieldNebula.removeChildren();
		const nebulaGraphics = new Graphics();
		starfield.drawNebula(nebulaGraphics, 0, 0);
		layers.starfieldNebula.addChild(nebulaGraphics);

		layers.starfieldDeep.removeChildren();
		const deepGraphics = new Graphics();
		starfield.drawDeepStars(deepGraphics, 0, 0);
		layers.starfieldDeep.addChild(deepGraphics);

		layers.starfieldMid.removeChildren();
		const midGraphics = new Graphics();
		starfield.drawMidStars(midGraphics, 0, 0);
		layers.starfieldMid.addChild(midGraphics);

		layers.starfieldNear.removeChildren();
		const nearGraphics = new Graphics();
		starfield.drawNearStars(nearGraphics, 0, 0);
		layers.starfieldNear.addChild(nearGraphics);
	}, [layers, starfield]);
}
