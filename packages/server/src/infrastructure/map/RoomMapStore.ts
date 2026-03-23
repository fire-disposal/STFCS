import { PROTOCOL_VERSION, type MapSnapshot, type Point, type TokenInfo } from "@vt/shared/core-types";

export interface RoomMapStoreConfig {
	width?: number;
	height?: number;
}

/**
 * 房间地图存储（战略收缩版）
 * - 单一职责：管理房间地图快照
 * - 使用内存存储，接口保持可替换（后续可切换 Redis/DB）
 */
export class RoomMapStore {
	private readonly _snapshots = new Map<string, MapSnapshot>();
	private readonly _defaultWidth: number;
	private readonly _defaultHeight: number;

	constructor(config: RoomMapStoreConfig = {}) {
		this._defaultWidth = config.width ?? 8192;
		this._defaultHeight = config.height ?? 8192;
	}

	getSnapshot(roomId: string): MapSnapshot {
		const existing = this._snapshots.get(roomId);
		if (existing) {
			return existing;
		}

		const created = this._createDefaultSnapshot(roomId);
		this._snapshots.set(roomId, created);
		return created;
	}

	saveSnapshot(roomId: string, snapshot: MapSnapshot): MapSnapshot {
		const normalized: MapSnapshot = {
			...snapshot,
			savedAt: Date.now(),
			version: snapshot.version || PROTOCOL_VERSION,
		};

		this._snapshots.set(roomId, normalized);
		return normalized;
	}

	upsertToken(
		roomId: string,
		tokenId: string,
		position: Point,
		heading: number,
		ownerId = "system",
		type: TokenInfo["type"] = "ship",
		size = 50,
		metadata: Record<string, unknown> = {}
	): TokenInfo {
		const snapshot = this.getSnapshot(roomId);
		const existing = snapshot.tokens.find((token) => token.id === tokenId);

		if (existing) {
			existing.ownerId = ownerId;
			existing.type = type;
			existing.size = size;
			existing.collisionRadius = Math.max(40, size);
			existing.position = position;
			existing.heading = heading;
			existing.metadata = {
				...existing.metadata,
				...metadata,
				updatedAt: Date.now(),
			};
			snapshot.savedAt = Date.now();
			return existing;
		}

		const created: TokenInfo = {
			id: tokenId,
			ownerId,
			position,
			heading,
			type,
			size,
			scale: 1,
			turnState: "waiting",
			maxMovement: 300,
			remainingMovement: 300,
			actionsPerTurn: 1,
			remainingActions: 1,
			layer: 1,
			collisionRadius: Math.max(40, size),
			metadata: {
				...metadata,
				createdAt: Date.now(),
			},
		};

		snapshot.tokens.push(created);
		snapshot.savedAt = Date.now();
		return created;
	}

	private _createDefaultSnapshot(roomId: string): MapSnapshot {
		const now = Date.now();
		return {
			version: PROTOCOL_VERSION,
			savedAt: now,
			map: {
				id: `${roomId}_frontier_sector`,
				width: this._defaultWidth,
				height: this._defaultHeight,
				name: `Frontier Combat Zone - ${roomId}`,
			},
			tokens: [
				{
					id: "neutral_station",
					ownerId: "neutral",
					position: { x: this._defaultWidth / 2, y: this._defaultHeight / 2 },
					heading: 0,
					type: "station",
					size: 120,
					scale: 1,
					turnState: "waiting",
					maxMovement: 0,
					remainingMovement: 0,
					actionsPerTurn: 0,
					remainingActions: 0,
					layer: 2,
					collisionRadius: 140,
					metadata: { role: "objective", theme: "derelict_station", createdAt: now },
				},
			],
			starMap: {
				stars: {
					frontier_star: {
						id: "frontier_star",
						name: "Frontier Prime",
						position: { x: this._defaultWidth / 2, y: this._defaultHeight / 2 },
						spectralType: "G",
						description: "Primary star for the combat sandbox map",
						tags: ["battlefield", "starter"],
						updatedAt: now,
					},
				},
				systems: {
					frontier_star: {
						starId: "frontier_star",
						planets: {},
						updatedAt: now,
					},
				},
			},
		};
	}
}

export default RoomMapStore;
