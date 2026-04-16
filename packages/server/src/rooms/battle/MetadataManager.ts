/**
 * 房间元数据管理
 */

import type { GameRoomState } from "../../schema/GameSchema.js";
import type { RoomMetadata } from "../../schema/types.js";
import type { PlayerManager } from "./PlayerManager.js";

export class MetadataManager {
	private displayName = "";
	private createdAt = Date.now();

	/** 设置房间显示名称 */
	setDisplayName(name: string): void {
		this.displayName = name;
	}

	/** 获取房间显示名称 */
	getDisplayName(): string {
		return this.displayName;
	}

	/** 获取创建时间 */
	getCreatedAt(): number {
		return this.createdAt;
	}

	/** 设置创建时间 */
	setCreatedAt(time: number): void {
		this.createdAt = time;
	}

	/** 同步元数据 */
	sync(
		state: GameRoomState,
		playerManager: PlayerManager,
		maxClients: number,
		setMetadata: (metadata: RoomMetadata) => void
	): void {
		const owner = playerManager.getOwnerProfile(state);
		const metadata: RoomMetadata = {
			roomType: "battle",
			name: this.displayName,
			phase: state.currentPhase,
			ownerId: owner?.sessionId ?? null,
			ownerShortId: owner?.shortId ?? null,
			maxPlayers: maxClients,
			isPrivate: false,
			createdAt: this.createdAt,
			turnCount: state.turnCount,
		};
		setMetadata(metadata);
	}
}