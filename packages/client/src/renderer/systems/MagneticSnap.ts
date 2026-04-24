/**
 * 磁性吸附系统 - 提供光标吸附功能
 * 
 * 功能：
 * 1. 鼠标靠近舰船时自动吸附/高亮
 * 2. 点击空地时吸附到最近的舰船或网格点
 * 3. 移动命令时吸附到合理的位置
 * 
 * 配置项：
 * - snapRadius: 吸附半径（像素）
 * - showHighlight: 是否显示高亮效果
 */

import { useEffect, useRef, useCallback } from "react";
import { Graphics } from "pixi.js";
import type { LayerRegistry } from "../core/useLayerSystem";
import type { CombatToken } from "@vt/data";
import { getMountWorldPosition, distanceBetween } from "@vt/data";
import { useUIStore } from "@/state/stores/uiStore";

interface SnapTarget {
	type: "ship" | "grid" | "weaponMount" | "shieldMount";
	id: string;
	x: number;
	y: number;
	distance: number;
	data?: {
		ship?: CombatToken;
		mountId?: string;
	};
}

interface MagneticSnapOptions {
	snapRadius: number;
	showHighlight: boolean;
	gridSize: number;
	snapToShips: boolean;
	snapToGrid: boolean;
	snapToMounts: boolean;
}

const DEFAULT_OPTIONS: MagneticSnapOptions = {
	snapRadius: 50,
	showHighlight: true,
	gridSize: 100,
	snapToShips: true,
	snapToGrid: true,
	snapToMounts: true,
};

export function useMagneticSnap(
	layers: LayerRegistry | null,
	ships: CombatToken[],
	canvasSize: { width: number; height: number },
	camera: { x: number; y: number; zoom: number; viewRotation: number },
	options: Partial<MagneticSnapOptions> = {}
) {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const highlightRef = useRef<Graphics | null>(null);
	const nearestShipRef = useRef<CombatToken | null>(null);
	const snapTargetRef = useRef<SnapTarget | null>(null);

	const gridSnap = useUIStore((state) => state.gridSnap);
	const gridSize = useUIStore((state) => state.gridSize);

	const getWorldMousePos = useCallback((screenX: number, screenY: number) => {
		const dx = screenX - canvasSize.width / 2;
		const dy = screenY - canvasSize.height / 2;
		const rad = (camera.viewRotation * Math.PI) / 180;
		const cos = Math.cos(-rad);
		const sin = Math.sin(-rad);
		const rotatedX = dx * cos - dy * sin;
		const rotatedY = dx * sin + dy * cos;
		return {
			x: rotatedX / camera.zoom + camera.x,
			y: rotatedY / camera.zoom + camera.y,
		};
	}, [canvasSize, camera]);

	const findSnapTargets = useCallback((worldX: number, worldY: number): SnapTarget[] => {
		const targets: SnapTarget[] = [];

		if (opts.snapToShips) {
			for (const ship of ships) {
				if (!ship.runtime?.position) continue;
				const dist = distanceBetween(ship.runtime.position, { x: worldX, y: worldY });

				if (dist <= opts.snapRadius * camera.zoom) {
					targets.push({
						type: "ship",
						id: ship.$id,
						x: ship.runtime.position.x,
						y: ship.runtime.position.y,
						distance: dist,
						data: { ship },
					});
				}

				if (opts.snapToMounts && ship.spec.mounts) {
					for (const mount of ship.spec.mounts) {
						const mountOffset = mount.position ?? { x: 0, y: 0 };
						const mountWorldPos = getMountWorldPosition(
							ship.runtime.position,
							ship.runtime.heading,
							mountOffset
						);
						const mountDist = distanceBetween(mountWorldPos, { x: worldX, y: worldY });

						if (mountDist <= opts.snapRadius * camera.zoom * 0.5) {
							targets.push({
								type: mount.weapon ? "weaponMount" : "shieldMount",
								id: `${ship.$id}:${mount.id}`,
								x: mountWorldPos.x,
								y: mountWorldPos.y,
								distance: mountDist,
								data: { ship, mountId: mount.id },
							});
						}
					}
				}
			}
		}

		if ((gridSnap || opts.snapToGrid) && gridSize > 0) {
			const gridX = Math.round(worldX / gridSize) * gridSize;
			const gridY = Math.round(worldY / gridSize) * gridSize;
			const gridDist = distanceBetween({ x: gridX, y: gridY }, { x: worldX, y: worldY });

			if (gridDist <= opts.snapRadius * camera.zoom * 0.3) {
				targets.push({
					type: "grid",
					id: `grid:${gridX}:${gridY}`,
					x: gridX,
					y: gridY,
					distance: gridDist,
				});
			}
		}

		return targets.sort((a, b) => a.distance - b.distance);
	}, [ships, opts, camera.zoom, gridSnap, gridSize]);

	const getNearestTarget = useCallback((worldX: number, worldY: number): SnapTarget | null => {
		const targets = findSnapTargets(worldX, worldY);
		return targets.length > 0 ? targets[0] : null;
	}, [findSnapTargets]);

	useEffect(() => {
		if (!layers?.world) return;

		let highlight = highlightRef.current;
		if (!highlight) {
			highlight = new Graphics();
			layers.world.addChild(highlight);
			highlightRef.current = highlight;
		}

		return () => {
			if (highlightRef.current && layers.world.children.includes(highlightRef.current)) {
				layers.world.removeChild(highlightRef.current);
				highlightRef.current.destroy();
				highlightRef.current = null;
			}
		};
	}, [layers]);

	const updateHighlight = useCallback((target: SnapTarget | null) => {
		const highlight = highlightRef.current;
		if (!highlight || !opts.showHighlight) return;

		highlight.clear();

		if (!target) {
			highlight.visible = false;
			return;
		}

		highlight.visible = true;
		highlight.position.set(target.x, target.y);

		const radius = target.distance < opts.snapRadius * 0.3 ? 30 : 20;
		const color = target.type === "ship" ? 0x4a9eff
			: target.type === "weaponMount" ? 0xff6b35
			: target.type === "shieldMount" ? 0x9b59b6
			: 0x6b7280;

		highlight.circle(0, 0, radius).stroke({ color, width: 2, alpha: 0.8 });
		highlight.circle(0, 0, radius * 0.5).fill({ color, alpha: 0.3 });
	}, [opts.showHighlight, opts.snapRadius]);

	const handleMouseMove = useCallback((screenX: number, screenY: number) => {
		const worldPos = getWorldMousePos(screenX, screenY);
		const target = getNearestTarget(worldPos.x, worldPos.y);
		snapTargetRef.current = target;
		nearestShipRef.current = target?.type === "ship" ? target.data?.ship ?? null : null;
		updateHighlight(target);
	}, [getWorldMousePos, getNearestTarget, updateHighlight]);

	const getSnapPosition = useCallback((worldX: number, worldY: number) => {
		const target = getNearestTarget(worldX, worldY);
		if (target) {
			return { x: target.x, y: target.y, target };
		}
		return { x: worldX, y: worldY, target: null };
	}, [getNearestTarget]);

	return {
		handleMouseMove,
		getSnapPosition,
		getNearestTarget,
		findSnapTargets,
		nearestShip: nearestShipRef.current,
		snapTarget: snapTargetRef.current,
		updateHighlight,
	};
}

export type MagneticSnapResult = ReturnType<typeof useMagneticSnap>;