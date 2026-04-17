/**
 * 战斗房间
 *
 * 使用 composition 模式组合各子模块
 */

import { Client, Room } from "@colyseus/core";
import { WeaponState } from "@vt/data";
import type { RoomMetadata } from "../schema/types.js";
import type { CreateObjectPayload, MoveTokenPayload } from "../commands/types.js";
import { CommandDispatcher } from "../commands/CommandDispatcher.js";
import { saveService } from "../services/SaveService.js";
import { roomOwnerRegistry } from "../services/RoomOwnerRegistry.js";
import { toGameSavedDto, toGameLoadedDto } from "../dto/index.js";
import { registerMessageController } from "../commands/MessageController.js";
import { GameRoomState } from "../schema/GameSchema.js";
import { ShipState, WeaponSlot } from "../schema/ShipStateSchema.js";
import {
	EMPTY_ROOM_TTL_MS,
	OWNER_LEAVE_TTL_MS,
	DEFAULT_MAX_CLIENTS,
	MAX_CLIENTS_LIMIT,
	MIN_CLIENTS,
	SIMULATION_INTERVAL_MS,
	MoveBuffer,
	QosMonitor,
	PlayerManager,
	MetadataManager,
	ObjectFactory,
} from "./battle/index.js";

export class BattleRoom extends Room<{ state: GameRoomState; metadata: RoomMetadata }> {
	maxClients = DEFAULT_MAX_CLIENTS;
	autoDispose = false;

	// 子模块
	private dispatcher!: CommandDispatcher;
	private moveBuffer = new MoveBuffer();
	private qosMonitor = new QosMonitor();
	private playerManager = new PlayerManager();
	private metadataManager = new MetadataManager();
	private objectFactory = new ObjectFactory();

	// 定时器
	private emptyDisposeTimeout: ReturnType<typeof setTimeout> | null = null;
	private ownerLeaveTimeout: ReturnType<typeof setTimeout> | null = null;
	/** 房主离开时记录的名称（用于匹配重新加入） */
	private ownerName: string | null = null;

	async onCreate(options: { roomName?: string; maxPlayers?: number }) {
		this.maxClients = Math.min(MAX_CLIENTS_LIMIT, Math.max(MIN_CLIENTS, options.maxPlayers ?? DEFAULT_MAX_CLIENTS));
		this.metadataManager.setDisplayName(options.roomName?.trim() || `Battle-${this.roomId.substring(0, 6)}`);
		this.metadataManager.setCreatedAt(Date.now());

		// 设置房间 ID 到 PlayerManager（用于房主注册）
		this.playerManager.setRoomId(this.roomId);

		this.state = new GameRoomState();
		this.dispatcher = new CommandDispatcher(this.state);

		registerMessageController(this, {
			state: this.state,
			dispatcher: this.dispatcher,
			logger: { log: () => {} },
			broadcast: (type: string, data: unknown) => this.broadcast(type, data),
			pingEwma: new Map(),
			jitterEwma: new Map(),
			getRoomOwnerId: () => this.playerManager.getOwnerId(),
			setMetadata: () => this.syncMetadata(),
			playerService: this.playerManager.getPlayerService(),
			createObject: (payload: CreateObjectPayload) => this.objectFactory.create(this.state, payload),
			enqueueMoveCommand: (client: Client, payload: MoveTokenPayload) =>
				this.moveBuffer.enqueue(payload.shipId, client, payload),
			dissolveRoom: () => this.disconnect(),
			saveGame: (name: string) => this.saveGame(name),
			loadGame: (saveId: string) => this.loadGame(saveId),
			// transferOwner 已禁用（DM权限固定）
		});

		this.syncMetadata();
		this.setSimulationInterval((dt) => this.update(dt / 1000), SIMULATION_INTERVAL_MS);
	}

	async onJoin(client: Client, options: { playerName?: string }) {
		this.cancelEmptyDisposeTimer();

		// 检查是否是房主重新加入
		const playerName = options.playerName?.trim();
		if (this.ownerName && playerName === this.ownerName && this.ownerLeaveTimeout) {
			// 房主重新加入，取消解散计时器
			this.cancelOwnerLeaveTimer();
			console.log(`[BattleRoom] 房主 ${playerName} 重新加入，取消解散计时器`);
		}

		const result = await this.playerManager.handleJoin(
			client,
			options,
			this.state,
			this.clients,
			this.maxClients,
			this.roomId,
			this.qosMonitor,
			this.ownerName // 传入房主名称用于恢复DM身份
		);

		if (result.success) {
			// 如果是房主重新加入，确保恢复DM身份
			if (result.player && result.player.name === this.ownerName && result.player.role !== "DM") {
				result.player.role = "DM";
				this.playerManager.setOwnerId(client.sessionId);
				this.broadcast("owner_rejoined", {
					sessionId: client.sessionId,
					shortId: result.player.shortId,
					name: result.player.name,
				});
			}

			this.syncMetadata();

			// 广播玩家加入事件（让其他客户端知道）
			if (result.player) {
				this.broadcast("player_joined", {
					sessionId: result.player.sessionId,
					shortId: result.player.shortId,
					name: result.player.name,
					role: result.player.role,
					isNew: result.isNew ?? false,
				});

				// 广播头像给所有房间成员（头像不走Schema）
				if (result.player.avatar && result.isNew) {
					this.broadcast("PLAYER_AVATAR", {
						shortId: result.player.shortId,
						avatar: result.player.avatar,
					});
				}
			}
		}
	}

	onLeave(client: Client, code?: number) {
		const player = this.state.players.get(client.sessionId);
		if (!player) return;

		// 广播玩家离线事件
		this.broadcast("player_left", {
			sessionId: client.sessionId,
			shortId: player.shortId,
			name: player.name,
			role: player.role,
		});

		// 删除玩家
		this.state.players.delete(client.sessionId);

		// 如果是房主离开，启动5分钟解散计时器
		if (player.role === "DM") {
			this.ownerName = player.name; // 记录房主名称
			this.broadcast("owner_left", {
				name: player.name,
				shortId: player.shortId,
				waitTimeSeconds: OWNER_LEAVE_TTL_MS / 1000,
			});
			this.scheduleOwnerLeaveDispose();
			console.log(`[BattleRoom] 房主 ${player.name} 离开，启动 ${OWNER_LEAVE_TTL_MS / 1000}s 解散计时器`);
			return;
		}

		this.syncMetadata();
		this.scheduleEmptyDisposeIfNeeded();
	}

	private update(dt: number) {
		this.moveBuffer.flush(this.dispatcher);
		this.state.ships.forEach((ship: ShipState) => {
			if (ship.isDestroyed) return;
			// 武器冷却实时更新（冷却时间需要实时递减）
			ship.weapons.forEach((w: WeaponSlot) => {
				w.cooldownRemaining = Math.max(0, w.cooldownRemaining - dt);
				if (w.state === WeaponState.COOLDOWN && w.cooldownRemaining <= 0) {
					w.state = w.currentAmmo === 0 && w.maxAmmo > 0 ? WeaponState.OUT_OF_AMMO : WeaponState.READY;
				}
			});
			// 过载时间实时更新
			if (ship.isOverloaded && ship.overloadTime > 0) {
				ship.overloadTime -= dt;
				if (ship.overloadTime <= 0) ship.isOverloaded = false;
			}
			// 注意：回合制游戏不在此处自动降低辐能
			// 辐能降低在 PhaseManager.ts 的回合结束阶段处理
		});
	}

	onDispose() {
		this.cancelEmptyDisposeTimer();
		// 清理房主注册
		roomOwnerRegistry.unregisterByRoom(this.roomId);
	}

	private syncMetadata(): void {
		this.metadataManager.sync(
			this.state,
			this.playerManager,
			this.maxClients,
			(meta) => this.setMetadata(meta)
		);
	}

	private scheduleEmptyDisposeIfNeeded(): void {
		if (this.clients.length > 0) return;
		if (this.emptyDisposeTimeout) return;

		this.emptyDisposeTimeout = setTimeout(() => {
			if (this.clients.length === 0) this.disconnect();
			this.emptyDisposeTimeout = null;
		}, EMPTY_ROOM_TTL_MS);
	}

	private cancelEmptyDisposeTimer(): void {
		if (this.emptyDisposeTimeout) {
			clearTimeout(this.emptyDisposeTimeout);
			this.emptyDisposeTimeout = null;
		}
	}

	private scheduleOwnerLeaveDispose(): void {
		if (this.ownerLeaveTimeout) return;

		this.ownerLeaveTimeout = setTimeout(() => {
			console.log(`[BattleRoom] 房主 ${this.ownerName} 未重新加入，解散房间`);
			this.broadcast("room_dissolved", { reason: "房主未在规定时间内重新加入" });
			this.disconnect();
			this.ownerLeaveTimeout = null;
			this.ownerName = null;
		}, OWNER_LEAVE_TTL_MS);
	}

	private cancelOwnerLeaveTimer(): void {
		if (this.ownerLeaveTimeout) {
			clearTimeout(this.ownerLeaveTimeout);
			this.ownerLeaveTimeout = null;
		}
	}

	async saveGame(name: string): Promise<string> {
		const saveId = await saveService.saveGame(this.state, this.roomId, name);
		this.broadcast("game_saved", toGameSavedDto(saveId, name));
		return saveId;
	}

	async loadGame(id: string): Promise<boolean> {
		try {
			const success = await saveService.loadGame(this.state, id);
			if (success) {
				const meta = await saveService.getSaveMetadata(id);
				this.broadcast("game_loaded", toGameLoadedDto(id, meta?.name || "未知存档"));
				this.syncMetadata();
			}
			return success;
		} catch {
			return false;
		}
	}
}