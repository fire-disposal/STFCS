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
	DEFAULT_MAX_CLIENTS,
	MAX_CLIENTS_LIMIT,
	MIN_CLIENTS,
	RECONNECTION_WINDOW_SECONDS,
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
			transferOwner: (targetSessionId: string) =>
				this.playerManager.transferOwnership(targetSessionId, this.state),
		});

		this.syncMetadata();
		this.setSimulationInterval((dt) => this.update(dt / 1000), SIMULATION_INTERVAL_MS);
	}

	async onJoin(client: Client, options: { playerName?: string }) {
		this.cancelEmptyDisposeTimer();

		const result = await this.playerManager.handleJoin(
			client,
			options,
			this.state,
			this.clients,
			this.maxClients,
			this.roomId,
			this.qosMonitor
		);

		if (result.success) {
			this.syncMetadata();
		}
	}

	onLeave(client: Client, code?: number) {
		const player = this.state.players.get(client.sessionId);
		if (!player) return;

		// 标记为离线
		player.connected = false;
		this.playerManager.clearOwnerIfOffline(client.sessionId, this.state);
		this.syncMetadata();

		// 主动离开（code 1000）不启用重连窗口，允许立即重新加入
		// 仅对意外断开启用重连窗口
		const isNormalLeave = code === 1000;
		if (isNormalLeave) {
			this.scheduleEmptyDisposeIfNeeded();
			return;
		}

		// 意外断开：短暂窗口内允许恢复
		this.allowReconnection(client, RECONNECTION_WINDOW_SECONDS)
			.then(() => {
				// 重连成功，恢复玩家状态
				player.connected = true;
				this.syncMetadata();
				this.cancelEmptyDisposeTimer();
			})
			.catch(() => {
				// 重连窗口超时，玩家状态保持离线
				// 用户可以手动点击"加入房间"重新加入（通过 playerName 匹配恢复）
				this.scheduleEmptyDisposeIfNeeded();
			});
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